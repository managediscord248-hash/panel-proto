import { Router } from "express";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getAllServers, getServerById, insertServer, updateServer, deleteServerRow, getServerByName, getAssignedServerIdsForUser, getAssignmentsForServer, setServerAssignments, deleteAssignmentsForServer } from "../store.js";
import { validateServerName, serverDir } from "../paths.js";
import { processManager } from "../process-manager.js";
import { downloadServerJar, getMinecraftVersions, SERVER_TYPES, type ServerType } from "../jar-downloader.js";
import { logAction, type AuthedRequest, requireRole, canAccessServer } from "../auth.js";

export const serverRoutes = Router();

serverRoutes.get("/", (req: AuthedRequest, res) => {
  let servers = getAllServers();
  if (req.user && req.user.role === "user") {
    const assignedIds = new Set(getAssignedServerIdsForUser(req.user.id));
    servers = servers.filter((s) => assignedIds.has(s.id));
  }
  res.json({
    servers: servers.map((s) => ({
      ...s,
      is_running: processManager.isRunning(s.id),
      current_status: processManager.getStatus(s.id) || s.status,
    })),
  });
});

serverRoutes.get("/:id", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  res.json({
    ...server,
    is_running: processManager.isRunning(server.id),
    current_status: processManager.getStatus(server.id) || server.status,
  });
});

serverRoutes.post("/", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const { name, port, memoryMb, maxPlayers, javaVersion, gameVersion, loader, worldName, motd, runtime, autoStart } = req.body;
  if (!name || !validateServerName(name)) {
    return res.status(400).json({ error: "Invalid server name (2-63 chars, alphanumeric, dash, underscore)" });
  }
  if (getServerByName(name)) {
    return res.status(409).json({ error: "Server name already exists" });
  }
  const portNum = parseInt(port, 10) || 25565;
  if (portNum < 1 || portNum > 65535) {
    return res.status(400).json({ error: "Invalid port number" });
  }
  const id = randomUUID();
  insertServer({
    id,
    name,
    port: portNum,
    memory_mb: parseInt(memoryMb, 10) || config.defaultMemoryMb,
    max_players: parseInt(maxPlayers, 10) || 20,
    java_version: javaVersion || "21",
    game_version: gameVersion || null,
    loader: loader || "vanilla",
    world_name: worldName || "world",
    motd: motd || null,
    runtime: runtime || "local",
    auto_start: autoStart ? 1 : 0,
  });
  const dir = serverDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "eula.txt"), "eula=true\n");

  if (req.body.autoDownloadJar && gameVersion) {
    try {
      const result = await downloadServerJar(loader as ServerType, gameVersion, id);
      logAction(req, "download_jar", name, `${loader} ${gameVersion} - ${result.size} bytes`);
    } catch (err: any) {
      logAction(req, "download_jar_failed", name, err.message);
    }
  }

  logAction(req, "create_server", name);
  res.json({ server: getServerById(id) });
});

serverRoutes.patch("/:id", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const { name, port, memoryMb, maxPlayers, javaVersion, gameVersion, loader, worldName, motd, autoStart } = req.body;
  if (name && name !== server.name) {
    if (!validateServerName(name)) return res.status(400).json({ error: "Invalid server name" });
    if (getServerByName(name)) return res.status(409).json({ error: "Name already exists" });
  }
  updateServer(server.id, {
    name: name || server.name,
    port: port ? parseInt(port, 10) : server.port,
    memory_mb: memoryMb ? parseInt(memoryMb, 10) : server.memory_mb,
    max_players: maxPlayers ? parseInt(maxPlayers, 10) : server.max_players,
    java_version: javaVersion || server.java_version,
    game_version: gameVersion !== undefined ? gameVersion : server.game_version,
    loader: loader || server.loader,
    world_name: worldName || server.world_name,
    motd: motd !== undefined ? motd : server.motd,
    auto_start: autoStart !== undefined ? (autoStart ? 1 : 0) : server.auto_start,
  });
  logAction(req, "update_server", server.name);
  res.json({ server: getServerById(server.id) });
});

serverRoutes.delete("/:id", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (processManager.isRunning(server.id)) {
    processManager.stopServer(server.id, true);
  }
  const dir = serverDir(server.id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  deleteAssignmentsForServer(server.id);
  deleteServerRow(server.id);
  logAction(req, "delete_server", server.name);
  res.json({ ok: true });
});

serverRoutes.post("/:id/start", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const result = processManager.startServer(server.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "start_server", server.name);
  res.json({ ok: true });
});

serverRoutes.post("/:id/stop", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const result = processManager.stopServer(server.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "stop_server", server.name);
  res.json({ ok: true });
});

serverRoutes.post("/:id/restart", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const result = processManager.restartServer(server.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "restart_server", server.name);
  res.json({ ok: true });
});

serverRoutes.post("/:id/kill", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const result = processManager.killServer(server.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "kill_server", server.name);
  res.json({ ok: true });
});

serverRoutes.post("/:id/command", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command required" });
  const result = processManager.sendCommand(server.id, command);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "send_command", server.name, command);
  res.json({ ok: true });
});

serverRoutes.get("/:id/console", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const logs = processManager.getConsoleLog(server.id);
  res.json({ lines: logs });
});

serverRoutes.get("/:id/console/stream", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("\n");

  const existing = processManager.getConsoleLog(server.id);
  for (const line of existing) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }

  const unsub = processManager.subscribeConsole(server.id, (line) => {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  });

  const statusUnsub = processManager.subscribeStatus(server.id, (status) => {
    res.write(`event: status\ndata: ${JSON.stringify({ status })}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(":heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    unsub();
    statusUnsub();
    clearInterval(heartbeat);
  });
});

serverRoutes.get("/:id/status", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  res.json({
    status: processManager.getStatus(server.id) || server.status,
    isRunning: processManager.isRunning(server.id),
  });
});

serverRoutes.post("/:id/download-jar", requireRole("owner", "admin"), async (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const { serverType, gameVersion } = req.body;
  if (!serverType || !gameVersion) {
    return res.status(400).json({ error: "serverType and gameVersion required" });
  }
  if (processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Stop the server before downloading a new JAR" });
  }
  try {
    const result = await downloadServerJar(serverType as ServerType, gameVersion, server.id);
    updateServer(server.id, { game_version: gameVersion, loader: serverType });
    logAction(req, "download_jar", server.name, `${serverType} ${gameVersion} - ${result.size} bytes`);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Server assignments - admin/owner only
serverRoutes.get("/:id/assignments", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json({ userIds: getAssignmentsForServer(server.id) });
});

serverRoutes.put("/:id/assignments", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const server = getServerById(req.params.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  const { userIds } = req.body;
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array" });
  }
  setServerAssignments(server.id, userIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !Number.isNaN(id)));
  logAction(req, "update_assignments", server.name, `Assigned to ${userIds.length} users`);
  res.json({ ok: true, userIds: getAssignmentsForServer(server.id) });
});

serverRoutes.get("/meta/versions", async (req: AuthedRequest, res) => {
  try {
    const versions = await getMinecraftVersions();
    res.json({ versions });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

serverRoutes.get("/meta/types", (_req: AuthedRequest, res) => {
  res.json({ types: SERVER_TYPES });
});
