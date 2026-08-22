import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { serverDir } from "./paths.js";
import { getServerById, updateServer, type ServerRow } from "./store.js";

interface ManagedProcess {
  child: ChildProcess;
  serverId: string;
  runtime: "local" | "docker";
  logBuffer: string[];
  status: "starting" | "running" | "stopping" | "crashed";
  startedAt: number;
  restartAttempts: number;
}

class ProcessManager extends EventEmitter {
  private processes = new Map<string, ManagedProcess>();
  private consoleSubscribers = new Map<string, Set<(line: string) => void>>();
  private statusListeners = new Map<string, Set<(status: string) => void>>();

  startServer(serverId: string): { ok: boolean; error?: string } {
    const server = getServerById(serverId);
    if (!server) return { ok: false, error: "Server not found" };
    if (this.processes.has(serverId)) return { ok: false, error: "Server already running" };

    const dir = serverDir(serverId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const jarPath = this.findJar(dir);
    if (!jarPath) {
      return { ok: false, error: "No server .jar found. Upload a server.jar first." };
    }

    updateServer(serverId, { status: "starting", started_at: new Date().toISOString(), pid: null });

    let child: ChildProcess;
    if (server.runtime === "docker") {
      child = this.spawnDocker(server, dir, jarPath);
    } else {
      child = this.spawnLocal(server, dir, jarPath);
    }

    const managed: ManagedProcess = {
      child,
      serverId,
      runtime: server.runtime,
      logBuffer: [],
      status: "starting",
      startedAt: Date.now(),
      restartAttempts: 0,
    };
    this.processes.set(serverId, managed);

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          this.pushLog(serverId, line);
        }
      }
    });
    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          this.pushLog(serverId, `[STDERR] ${line}`);
        }
      }
    });

    child.on("spawn", () => {
      managed.status = "running";
      updateServer(serverId, { status: "running", pid: child.pid ?? null });
      this.emitStatus(serverId, "running");
    });

    child.on("exit", (code, signal) => {
      const crashed = code !== null && code !== 0 && code !== 130 && code !== 143 && signal !== "SIGTERM";
      const newStatus = crashed ? "crashed" : "stopped";
      managed.status = crashed ? "crashed" : "stopping";
      this.processes.delete(serverId);
      updateServer(serverId, { status: newStatus, pid: null, started_at: null });
      this.emitStatus(serverId, newStatus);
      this.pushLog(serverId, `[AZ PANEL] Process exited with code ${code}, signal ${signal}`);
    });

    child.on("error", (err) => {
      this.pushLog(serverId, `[AZ PANEL] Process error: ${err.message}`);
      this.processes.delete(serverId);
      updateServer(serverId, { status: "crashed", pid: null });
      this.emitStatus(serverId, "crashed");
    });

    return { ok: true };
  }

  private spawnLocal(server: ServerRow, dir: string, jarPath: string): ChildProcess {
    const javaBin = this.findJava(server.java_version);
    const jarName = path.basename(jarPath);
    const args = [
      `-Xmx${server.memory_mb}M`,
      "-XX:+UseG1GC",
      "-XX:+ParallelRefProcEnabled",
      "-jar",
      jarName,
      "nogui",
    ];
    return spawn(javaBin, args, {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
  }

  private spawnDocker(server: ServerRow, dir: string, jarPath: string): ChildProcess {
    const jarName = path.basename(jarPath);
    const containerName = `azpanel-${server.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const args = [
      "run", "--rm", "-i",
      "--name", containerName,
      "-p", `${server.port}:25565`,
      "-v", `${dir}:/data`,
      "-w", "/data",
      config.dockerImage,
      `java`, `-Xmx${server.memory_mb}M`, `-XX:+UseG1GC`, `-jar`, jarName, "nogui",
    ];
    return spawn("docker", args, {
      cwd: dir,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
  }

  stopServer(serverId: string, graceful = true): { ok: boolean; error?: string } {
    const managed = this.processes.get(serverId);
    if (!managed) return { ok: false, error: "Server not running" };

    if (graceful) {
      this.sendCommand(serverId, "stop");
      setTimeout(() => {
        if (this.processes.has(serverId)) {
          managed.child.kill("SIGTERM");
        }
      }, 10000);
    } else {
      managed.child.kill("SIGKILL");
    }

    updateServer(serverId, { status: "stopping" });
    this.emitStatus(serverId, "stopping");
    return { ok: true };
  }

  restartServer(serverId: string): { ok: boolean; error?: string } {
    const managed = this.processes.get(serverId);
    if (!managed) return this.startServer(serverId);
    managed.child.once("exit", () => {
      setTimeout(() => this.startServer(serverId), 1000);
    });
    this.stopServer(serverId, true);
    return { ok: true };
  }

  sendCommand(serverId: string, command: string): { ok: boolean; error?: string } {
    const managed = this.processes.get(serverId);
    if (!managed) return { ok: false, error: "Server not running" };
    if (managed.runtime === "docker") {
      const containerName = `azpanel-${getServerById(serverId)?.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      spawn("docker", ["exec", "-i", containerName, "sh", "-c", `echo '${command.replace(/'/g, "'\\''")}' > /proc/1/fd/0`]);
    } else {
      managed.child.stdin?.write(command + "\n");
    }
    this.pushLog(serverId, `[CONSOLE] ${command}`);
    return { ok: true };
  }

  killServer(serverId: string): { ok: boolean; error?: string } {
    return this.stopServer(serverId, false);
  }

  isRunning(serverId: string): boolean {
    return this.processes.has(serverId);
  }

  getStatus(serverId: string): string {
    return this.processes.get(serverId)?.status ?? "stopped";
  }

  getConsoleLog(serverId: string): string[] {
    return this.processes.get(serverId)?.logBuffer ?? [];
  }

  subscribeConsole(serverId: string, cb: (line: string) => void): () => void {
    if (!this.consoleSubscribers.has(serverId)) {
      this.consoleSubscribers.set(serverId, new Set());
    }
    this.consoleSubscribers.get(serverId)!.add(cb);
    return () => {
      this.consoleSubscribers.get(serverId)?.delete(cb);
    };
  }

  subscribeStatus(serverId: string, cb: (status: string) => void): () => void {
    if (!this.statusListeners.has(serverId)) {
      this.statusListeners.set(serverId, new Set());
    }
    this.statusListeners.get(serverId)!.add(cb);
    return () => {
      this.statusListeners.get(serverId)?.delete(cb);
    };
  }

  private pushLog(serverId: string, line: string): void {
    const managed = this.processes.get(serverId);
    if (managed) {
      managed.logBuffer.push(line);
      if (managed.logBuffer.length > config.consoleLineLimit) {
        managed.logBuffer.shift();
      }
    }
    this.consoleSubscribers.get(serverId)?.forEach((cb) => cb(line));
  }

  private emitStatus(serverId: string, status: string): void {
    this.statusListeners.get(serverId)?.forEach((cb) => cb(status));
  }

  private findJar(dir: string): string | null {
    const files = fs.readdirSync(dir);
    const jar = files.find((f) => f.endsWith(".jar"));
    return jar ? path.join(dir, jar) : null;
  }

  private findJava(version: string): string {
    const candidates = [
      `java-${version}-openjdk`,
      `java${version}`,
      `/usr/lib/jvm/java-${version}-openjdk/bin/java`,
      `/usr/lib/jvm/java-${version}-openjdk-amd64/bin/java`,
    ];
    for (const c of candidates) {
      try {
        fs.accessSync(c, fs.constants.X_OK);
        return c;
      } catch {
        // try next
      }
    }
    return "java";
  }
}

export const processManager = new ProcessManager();
