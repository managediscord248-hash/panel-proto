import path from "node:path";
import { config } from "./config.js";

const ROOT = path.resolve(config.serversDir);

export function isSafePath(relativePath: string): boolean {
  if (!relativePath) return false;
  const resolved = path.resolve(ROOT, relativePath);
  const rel = path.relative(ROOT, resolved);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function resolveSafe(relativePath: string): string {
  if (!isSafePath(relativePath)) {
    throw new Error("Path traversal detected");
  }
  return path.resolve(ROOT, relativePath);
}

export function serverDir(serverId: string): string {
  return path.resolve(ROOT, serverId);
}

export function safeServerPath(serverId: string, relativePath: string): string {
  const base = serverDir(serverId);
  const resolved = path.resolve(base, relativePath);
  const rel = path.relative(base, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export function validateServerName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$/.test(name);
}

export function validateUsername(name: string): boolean {
  return /^[a-zA-Z0-9_]{3,32}$/.test(name);
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}
