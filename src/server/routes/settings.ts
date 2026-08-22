import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getSettings, setSetting } from "../store.js";
import { requireAuth, requireRole, logAction, type AuthedRequest } from "../auth.js";

export const settingsRoutes = Router();

settingsRoutes.get("/", (req: AuthedRequest, res) => {
  const all = getSettings();
  // Don't expose jwt_secret
  delete all["jwt_secret"];
  res.json({ settings: all });
});

settingsRoutes.patch("/", requireAuth, requireRole("owner"), (req: AuthedRequest, res) => {
  const allowed = ["panel_name", "panel_motd", "default_java", "default_memory", "max_upload_mb", "registration_enabled", "theme_color", "logo_url", "bg_url", "startup_animation"];
  const updates = req.body.settings || req.body;
  const applied: Record<string, string> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key) && typeof value === "string") {
      setSetting(key, value);
      applied[key] = value;
    }
  }
  logAction(req, "update_settings", undefined, JSON.stringify(applied));
  res.json({ ok: true, settings: applied });
});

// Upload logo or background image
settingsRoutes.post("/upload", requireAuth, requireRole("owner"), (req: AuthedRequest, res) => {
  const type = (req.query.type as string) || "";
  if (type !== "logo" && type !== "bg") {
    return res.status(400).json({ error: "Type must be 'logo' or 'bg'" });
  }

  const uploadsDir = path.join(config.dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const buffers: Buffer[] = [];
  let size = 0;
  const maxBytes = 10 * 1024 * 1024; // 10MB for images

  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > maxBytes) {
      res.status(413).json({ error: "Image too large (max 10MB)" });
      req.destroy();
      return;
    }
    buffers.push(chunk);
  });

  req.on("end", () => {
    try {
      const boundary = req.headers["content-type"]?.split("boundary=")[1];
      if (!boundary) {
        return res.status(400).json({ error: "No boundary in content-type" });
      }
      const data = Buffer.concat(buffers);
      const files = parseMultipart(data, boundary);
      if (files.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = files[0];
      const ext = path.extname(file.filename).toLowerCase() || ".png";
      const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({ error: "Invalid file type. Use PNG, JPG, GIF, SVG, or WebP" });
      }

      const filename = `${type}${ext}`;
      const filepath = path.join(uploadsDir, filename);

      // Remove old files with different extensions
      for (const e of allowedExts) {
        const old = path.join(uploadsDir, `${type}${e}`);
        if (old !== filepath && fs.existsSync(old)) fs.unlinkSync(old);
      }

      fs.writeFileSync(filepath, file.data);

      const url = `/api/settings/image/${type}`;
      setSetting(type === "logo" ? "logo_url" : "bg_url", url);
      logAction(req, "upload_image", type);
      res.json({ ok: true, url });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
});

// Serve uploaded images
settingsRoutes.get("/image/:type", (req, res) => {
  const type = req.params.type;
  if (type !== "logo" && type !== "bg") {
    return res.status(400).json({ error: "Invalid type" });
  }
  const uploadsDir = path.join(config.dataDir, "uploads");
  const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
  for (const ext of allowedExts) {
    const filepath = path.join(uploadsDir, `${type}${ext}`);
    if (fs.existsSync(filepath)) {
      const mimeMap: Record<string, string> = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp",
      };
      res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-cache");
      return res.sendFile(filepath);
    }
  }
  res.status(404).json({ error: "Image not found" });
});

// Clear logo or background
settingsRoutes.delete("/image/:type", requireAuth, requireRole("owner"), (req: AuthedRequest, res) => {
  const type = req.params.type;
  if (type !== "logo" && type !== "bg") {
    return res.status(400).json({ error: "Invalid type" });
  }
  const uploadsDir = path.join(config.dataDir, "uploads");
  const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
  for (const ext of allowedExts) {
    const filepath = path.join(uploadsDir, `${type}${ext}`);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  setSetting(type === "logo" ? "logo_url" : "bg_url", "");
  logAction(req, "remove_image", type);
  res.json({ ok: true });
});

interface ParsedFile {
  filename: string;
  data: Buffer;
  mimetype: string;
}

function parseMultipart(data: Buffer, boundary: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const sep = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const idx = data.indexOf(sep, start);
    if (idx === -1) break;
    if (start > 0) parts.push(data.slice(start, idx));
    start = idx + sep.length;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headerStr = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4, part.length - 2);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    if (!filenameMatch || !nameMatch) continue;
    const ctMatch = headerStr.match(/Content-Type:\s*(\S+)/i);
    files.push({
      filename: filenameMatch[1],
      data: body,
      mimetype: ctMatch ? ctMatch[1] : "application/octet-stream",
    });
  }
  return files;
}
