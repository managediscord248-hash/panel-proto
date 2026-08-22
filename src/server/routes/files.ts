import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { listFiles, getFileContent, saveFileContent, createDirectory, deleteFile, renameFile, uploadFile, getFilePath, getFileStats, moveFile } from "../files.js";
import { logAction, type AuthedRequest, requireRole, canAccessServer } from "../auth.js";
import { sanitizeFilename } from "../paths.js";
import { getServerById } from "../store.js";

export const fileRoutes = Router();

function checkAccess(req: AuthedRequest, res: any): boolean {
  const serverId = req.params.serverId;
  const server = getServerById(serverId);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return false;
  }
  if (!canAccessServer(req.user, serverId)) {
    res.status(403).json({ error: "You do not have access to this server" });
    return false;
  }
  return true;
}

fileRoutes.get("/:serverId/list", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const dir = (req.query.path as string) || "";
  try {
    const files = listFiles(req.params.serverId, dir);
    res.json({ files });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.get("/:serverId/download", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const filePath = (req.query.path as string) || "";
  try {
    const abs = getFilePath(req.params.serverId, filePath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "File not found" });
    res.download(abs, path.basename(abs));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.get("/:serverId/content", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const filePath = (req.query.path as string) || "";
  try {
    const content = getFileContent(req.params.serverId, filePath);
    res.json({ content });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.put("/:serverId/content", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const filePath = (req.query.path as string) || "";
  const { content } = req.body;
  if (content === undefined) return res.status(400).json({ error: "Content required" });
  try {
    saveFileContent(req.params.serverId, filePath, content);
    logAction(req, "edit_file", `${req.params.serverId}/${filePath}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.post("/:serverId/mkdir", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: "Path required" });
  try {
    createDirectory(req.params.serverId, dirPath);
    logAction(req, "mkdir", `${req.params.serverId}/${dirPath}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.delete("/:serverId", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const filePath = (req.query.path as string) || "";
  try {
    deleteFile(req.params.serverId, filePath);
    logAction(req, "delete_file", `${req.params.serverId}/${filePath}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.post("/:serverId/rename", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const { path: oldPath, newName } = req.body;
  if (!oldPath || !newName) return res.status(400).json({ error: "Path and newName required" });
  try {
    renameFile(req.params.serverId, oldPath, newName);
    logAction(req, "rename_file", `${req.params.serverId}/${oldPath} -> ${newName}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.post("/:serverId/move", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: "oldPath and newPath required" });
  try {
    moveFile(req.params.serverId, oldPath, newPath);
    logAction(req, "move_file", `${req.params.serverId}/${oldPath} -> ${newPath}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

fileRoutes.post("/:serverId/upload", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const targetDir = (req.query.path as string) || "";
  const buffers: Buffer[] = [];
  let size = 0;
  const maxBytes = config.maxUploadMb * 1024 * 1024;

  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > maxBytes) {
      res.status(413).json({ error: "File too large" });
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
      for (const file of files) {
        uploadFile(req.params.serverId, targetDir, { name: file.filename, data: file.data, mimetype: file.mimetype });
      }
      logAction(req, "upload_file", `${req.params.serverId}/${targetDir}`, `${files.length} files`);
      res.json({ ok: true, count: files.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
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
