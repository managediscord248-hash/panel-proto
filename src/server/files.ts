import fs from "node:fs";
import path from "node:path";
import { safeServerPath, sanitizeFilename } from "./paths.js";
import { config } from "./config.js";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension?: string;
}

export function listFiles(serverId: string, relativePath: string = ""): FileEntry[] {
  const abs = safeServerPath(serverId, relativePath || ".");
  if (!fs.existsSync(abs)) return [];
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const result: FileEntry[] = [];
  for (const entry of entries) {
    const fullPath = path.join(abs, entry.name);
    const stat = fs.statSync(fullPath);
    const relPath = path.join(relativePath, entry.name);
    result.push({
      name: entry.name,
      path: relPath,
      isDirectory: entry.isDirectory(),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
    });
  }
  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return result;
}

export function getFileContent(serverId: string, relativePath: string, maxSize = 1024 * 1024): string {
  const abs = safeServerPath(serverId, relativePath);
  const stat = fs.statSync(abs);
  if (stat.size > maxSize) {
    throw new Error(`File too large (${stat.size} bytes, max ${maxSize})`);
  }
  return fs.readFileSync(abs, "utf-8");
}

export function saveFileContent(serverId: string, relativePath: string, content: string): void {
  const abs = safeServerPath(serverId, relativePath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

export function createDirectory(serverId: string, relativePath: string): void {
  const abs = safeServerPath(serverId, relativePath);
  fs.mkdirSync(abs, { recursive: true });
}

export function deleteFile(serverId: string, relativePath: string): void {
  const abs = safeServerPath(serverId, relativePath);
  if (fs.existsSync(abs)) {
    fs.rmSync(abs, { recursive: true, force: true });
  }
}

export function renameFile(serverId: string, oldPath: string, newName: string): void {
  const absOld = safeServerPath(serverId, oldPath);
  const dir = path.dirname(absOld);
  const safeName = sanitizeFilename(newName);
  const absNew = path.join(dir, safeName);
  const base = path.resolve(config.serversDir, serverId);
  const rel = path.relative(base, absNew);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid rename target");
  }
  fs.renameSync(absOld, absNew);
}

export async function uploadFile(serverId: string, relativePath: string, file: { name: string; data: Buffer; mimetype: string }): Promise<void> {
  const safeName = sanitizeFilename(file.name);
  const targetDir = safeServerPath(serverId, relativePath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, safeName);
  const base = path.resolve(config.serversDir, serverId);
  const rel = path.relative(base, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid upload path");
  }
  fs.writeFileSync(target, file.data);
}

export function getFilePath(serverId: string, relativePath: string): string {
  return safeServerPath(serverId, relativePath);
}

export function getFileStats(serverId: string, relativePath: string): { size: number; modified: string; isDirectory: boolean } {
  const abs = safeServerPath(serverId, relativePath);
  const stat = fs.statSync(abs);
  return { size: stat.size, modified: stat.mtime.toISOString(), isDirectory: stat.isDirectory() };
}

export function moveFile(serverId: string, oldPath: string, newPath: string): void {
  const absOld = safeServerPath(serverId, oldPath);
  const absNew = safeServerPath(serverId, newPath);
  const dir = path.dirname(absNew);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(absOld, absNew);
}
