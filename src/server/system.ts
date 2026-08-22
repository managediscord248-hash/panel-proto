import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

export interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  cpuCores: number;
  cpuUsage: number;
  memTotal: number;
  memUsed: number;
  memFree: number;
  memUsagePercent: number;
  diskTotal: number;
  diskUsed: number;
  diskFree: number;
  diskUsagePercent: number;
  loadAvg: number[];
  kernel: string;
}

export function getSystemStats(): SystemStats {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = (usedMem / totalMem) * 100;

  let diskTotal = 0, diskFree = 0;
  try {
    const df = execSync("df -B1 /", { encoding: "utf-8" }).trim().split("\n");
    if (df.length >= 2) {
      const parts = df[1].split(/\s+/);
      diskTotal = parseInt(parts[1], 10) || 0;
      diskFree = parseInt(parts[3], 10) || 0;
    }
  } catch { /* ignore */ }
  const diskUsed = diskTotal - diskFree;
  const diskUsagePercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  let cpuUsage = 0;
  try {
    const load = os.loadavg();
    cpuUsage = (load[0] / os.cpus().length) * 100;
  } catch { /* ignore */ }

  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    uptime: os.uptime(),
    cpuCores: os.cpus().length,
    cpuUsage: Math.min(cpuUsage, 100),
    memTotal: totalMem,
    memUsed: usedMem,
    memFree: freeMem,
    memUsagePercent,
    diskTotal,
    diskUsed,
    diskFree,
    diskUsagePercent,
    loadAvg: os.loadavg(),
    kernel: `${os.type()} ${os.release()}`,
  };
}

export interface JavaVersion {
  path: string;
  version: string;
}

export function getInstalledJavaVersions(): JavaVersion[] {
  const versions: JavaVersion[] = [];
  try {
    const dirs = ["/usr/lib/jvm"];
    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const bin = path.join(dir, entry, "bin", "java");
          if (fs.existsSync(bin)) {
            let version = entry;
            try {
              const out = execSync(`"${bin}" -version 2>&1`, { encoding: "utf-8", timeout: 5000 });
              const match = out.match(/version "([^"]+)"/);
              if (match) version = match[1];
            } catch { /* ignore */ }
            versions.push({ path: bin, version });
          }
        }
      }
    }
  } catch { /* ignore */ }
  if (versions.length === 0) {
    try {
      const out = execSync("java -version 2>&1", { encoding: "utf-8", timeout: 5000 });
      const match = out.match(/version "([^"]+)"/);
      versions.push({ path: "java", version: match ? match[1] : "unknown" });
    } catch { /* ignore */ }
  }
  return versions;
}
