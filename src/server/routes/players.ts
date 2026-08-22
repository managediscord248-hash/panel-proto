import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { getServerById } from "../store.js";
import { serverDir } from "../paths.js";
import { processManager } from "../process-manager.js";
import { logAction, canAccessServer, type AuthedRequest } from "../auth.js";

export const playerRoutes = Router();

interface PlayerEntry {
  name: string;
  uuid?: string;
  expires?: string | null;
  reason?: string | null;
}

function readJsonList(dir: string, filename: string): PlayerEntry[] {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((entry: any) => ({
      name: entry.name ?? entry.uuid ?? "Unknown",
      uuid: entry.uuid,
      expires: entry.expires ?? null,
      reason: entry.reason ?? null,
    }));
  } catch {
    return [];
  }
}

function readOpsList(dir: string): PlayerEntry[] {
  const filePath = path.join(dir, "ops.json");
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((entry: any) => ({
      name: entry.name ?? "Unknown",
      uuid: entry.uuid,
      expires: null,
      reason: null,
    }));
  } catch {
    return [];
  }
}

function parseOnlinePlayersFromLog(serverId: string): string[] {
  const logs = processManager.getConsoleLog(serverId);
  const players = new Set<string>();
  for (const line of logs) {
    const joinMatch = line.match(/(\w+)\[.*?\] joined the game/);
    if (joinMatch) players.add(joinMatch[1]);
    const leaveMatch = line.match(/(\w\[.*?\]) left the game/);
    if (leaveMatch) players.delete(leaveMatch[1]);
  }
  return Array.from(players);
}

playerRoutes.get("/:serverId/players", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const dir = serverDir(server.id);
  const isRunning = processManager.isRunning(server.id);

  const bannedPlayers = readJsonList(dir, "banned-players.json");
  const bannedIps = readJsonList(dir, "banned-ips.json");
  const whitelist = readJsonList(dir, "whitelist.json");
  const ops = readOpsList(dir);
  const online = isRunning ? parseOnlinePlayersFromLog(server.id) : [];

  res.json({
    online,
    banned: bannedPlayers,
    bannedIps,
    whitelist,
    ops,
    isRunning,
  });
});

playerRoutes.post("/:serverId/players/kick", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `kick ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "kick_player", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/ban", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player, reason } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const cmd = reason ? `ban ${player} ${reason}` : `ban ${player}`;
  const result = processManager.sendCommand(server.id, cmd);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "ban_player", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/unban", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `pardon ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "unban_player", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/whitelist/add", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `whitelist add ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "whitelist_add", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/whitelist/remove", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `whitelist remove ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "whitelist_remove", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/op", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `op ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "op_player", server.name, player);
  res.json({ ok: true });
});

playerRoutes.post("/:serverId/players/deop", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const { player } = req.body;
  if (!player) return res.status(400).json({ error: "Player name required" });
  if (!processManager.isRunning(server.id)) {
    return res.status(400).json({ error: "Server is not running" });
  }
  const result = processManager.sendCommand(server.id, `deop ${player}`);
  if (!result.ok) return res.status(400).json({ error: result.error });
  logAction(req, "deop_player", server.name, player);
  res.json({ ok: true });
});
