import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { getServerById, updateServer } from "../store.js";
import { serverDir, safeServerPath } from "../paths.js";
import { processManager } from "../process-manager.js";
import { logAction, canAccessServer, type AuthedRequest } from "../auth.js";

export const optionsRoutes = Router();

const PROPERTIES_FILE = "server.properties";

interface PropertiesData {
  motd?: string;
  difficulty?: string;
  onlineMode?: boolean;
  spawnProtection?: number;
  whitelistEnabled?: boolean;
  pvp?: boolean;
  levelName?: string;
  maxPlayers?: number;
  [key: string]: any;
}

function parseProperties(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

function writeProperties(filePath: string, props: Record<string, string>): void {
  const lines: string[] = [];
  lines.push("# AZ Panel managed server.properties");
  for (const [key, value] of Object.entries(props)) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
}

function getProperties(serverId: string): PropertiesData {
  const dir = serverDir(serverId);
  const filePath = path.join(dir, PROPERTIES_FILE);
  const raw = parseProperties(filePath);
  return {
    motd: raw["motd"] ?? undefined,
    difficulty: raw["difficulty"] ?? undefined,
    onlineMode: raw["online-mode"] === "true",
    spawnProtection: raw["spawn-protection"] !== undefined ? parseInt(raw["spawn-protection"], 10) : undefined,
    whitelistEnabled: raw["white-list"] === "true",
    pvp: raw["pvp"] === "true",
    levelName: raw["level-name"] ?? undefined,
    maxPlayers: raw["max-players"] !== undefined ? parseInt(raw["max-players"], 10) : undefined,
  ...raw,
  };
}

optionsRoutes.get("/:serverId/properties", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const props = getProperties(server.id);
  res.json({ properties: props });
});

optionsRoutes.patch("/:serverId/properties", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const dir = serverDir(server.id);
  const filePath = path.join(dir, PROPERTIES_FILE);
  const current = parseProperties(filePath);
  const updates = req.body as Record<string, any>;

  const allowedKeys: Record<string, (v: any) => string> = {
    "motd": (v) => String(v ?? ""),
    "difficulty": (v) => String(v ?? "easy"),
    "online-mode": (v) => v ? "true" : "false",
    "spawn-protection": (v) => String(Math.max(0, parseInt(v, 10) || 0)),
    "white-list": (v) => v ? "true" : "false",
    "pvp": (v) => v ? "true" : "false",
    "max-players": (v) => String(Math.max(1, parseInt(v, 10) || 20)),
    "level-name": (v) => String(v ?? "world"),
    "server-port": (v) => String(parseInt(v, 10) || 25565),
    "view-distance": (v) => String(Math.max(3, parseInt(v, 10) || 10)),
    "simulation-distance": (v) => String(Math.max(3, parseInt(v, 10) || 10)),
    "allow-flight": (v) => v ? "true" : "false",
    "allow-nether": (v) => v ? "true" : "false",
    "spawn-animals": (v) => v ? "true" : "false",
    "spawn-monsters": (v) => v ? "true" : "false",
    "spawn-npcs": (v) => v ? "true" : "false",
    "enable-command-block": (v) => v ? "true" : "false",
    "force-gamemode": (v) => v ? "true" : "false",
  };

  const changed: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys[key]) {
      current[key] = allowedKeys[key](value);
      changed.push(key);
    }
  }

  writeProperties(filePath, current);

  if ("motd" in updates && updates.motd !== undefined) {
    updateServer(server.id, { motd: String(updates.motd) });
  }

  const needsRestart = changed.some((k) =>
    ["online-mode", "server-port", "level-name", "spawn-protection"].includes(k)
  );

  logAction(req, "update_properties", server.name, changed.join(", "));
  res.json({ ok: true, needsRestart, changed });
});

optionsRoutes.post("/:serverId/icon", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const busboy = req as any;
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Multipart form data required" });
  }

  const chunks: Buffer[] = [];
  let fileName = "";

  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    const boundary = contentType.split("boundary=")[1];
    if (!boundary) return res.status(400).json({ error: "No boundary" });

    const body = Buffer.concat(chunks);
    const boundaryBuf = Buffer.from("--" + boundary);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) {
      const idx = body.indexOf(boundaryBuf, start);
      if (idx === -1) break;
      if (start > 0) parts.push(body.slice(start, idx));
      start = idx + boundaryBuf.length;
      if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
      start += 2;
    }

    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const header = part.slice(0, headerEnd).toString("utf-8");
      const data = part.slice(headerEnd + 4, part.length - 2);

      const nameMatch = header.match(/name="([^"]+)"/);
      if (!nameMatch || nameMatch[1] !== "file") continue;

      const filenameMatch = header.match(/filename="([^"]+)"/);
      fileName = filenameMatch ? filenameMatch[1] : "server-icon.png";

      const ext = path.extname(fileName).toLowerCase();
      if (![".png", ".jpg", ".jpeg"].includes(ext)) {
        return res.status(400).json({ error: "Only PNG and JPEG images are allowed" });
      }
      if (data.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Image must be under 5MB" });
      }

      const dir = serverDir(server.id);
      const iconPath = path.join(dir, "server-icon.png");

      try {
        const sharp = require("sharp");
        sharp(data)
          .resize(64, 64, { fit: "cover" })
          .png()
          .toFile(iconPath, (err: any) => {
            if (err) {
              fs.writeFileSync(iconPath, data);
            }
            logAction(req, "upload_icon", server.name);
            res.json({ ok: true });
          });
      } catch {
        fs.writeFileSync(iconPath, data);
        logAction(req, "upload_icon", server.name);
        res.json({ ok: true });
      }
      return;
    }

    res.status(400).json({ error: "No file uploaded" });
  });
});

optionsRoutes.get("/:serverId/icon", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const dir = serverDir(server.id);
  const iconPath = path.join(dir, "server-icon.png");
  if (!fs.existsSync(iconPath)) {
    return res.status(404).json({ error: "No icon set" });
  }
  res.sendFile(iconPath);
});

optionsRoutes.delete("/:serverId/icon", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const dir = serverDir(server.id);
  const iconPath = path.join(dir, "server-icon.png");
  if (fs.existsSync(iconPath)) {
    fs.unlinkSync(iconPath);
  }
  logAction(req, "delete_icon", server.name);
  res.json({ ok: true });
});

optionsRoutes.post("/:serverId/whitelist/toggle", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, server.id)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }

  const { enabled } = req.body;
  const dir = serverDir(server.id);
  const filePath = path.join(dir, PROPERTIES_FILE);
  const props = parseProperties(filePath);
  props["white-list"] = enabled ? "true" : "false";
  writeProperties(filePath, props);

  if (processManager.isRunning(server.id)) {
    processManager.sendCommand(server.id, enabled ? "whitelist on" : "whitelist off");
  }

  logAction(req, "toggle_whitelist", server.name, enabled ? "on" : "off");
  res.json({ ok: true });
});
