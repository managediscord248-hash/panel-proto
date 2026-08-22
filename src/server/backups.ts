import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { serverDir } from "./paths.js";
import { config } from "./config.js";
import { insertBackup, getBackupById, deleteBackupRow, getBackupsForServer } from "./store.js";
import { randomUUID } from "node:crypto";

export function createBackup(serverId: string, serverName: string): { id: string; filename: string; size: number } {
  const dir = serverDir(serverId);
  if (!fs.existsSync(dir)) {
    throw new Error("Server directory not found");
  }
  fs.mkdirSync(config.backupsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${serverName}_${timestamp}.tar.gz`;
  const backupPath = path.join(config.backupsDir, filename);

  // Simple tar.gz using tar (system command)
  const { execSync } = require("node:child_process");
  execSync(`tar czf "${backupPath}" -C "${dir}" .`, { stdio: "pipe" });

  const stat = fs.statSync(backupPath);
  const id = randomUUID();
  insertBackup({ id, server_id: serverId, filename, size_bytes: stat.size, status: "ok" });
  return { id, filename, size: stat.size };
}

export function restoreBackup(serverId: string, backupId: string): void {
  const backup = getBackupById(backupId);
  if (!backup) throw new Error("Backup not found");
  const backupPath = path.join(config.backupsDir, backup.filename);
  if (!fs.existsSync(backupPath)) throw new Error("Backup file missing");

  const dir = serverDir(serverId);
  fs.mkdirSync(dir, { recursive: true });
  // Clear existing files
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const { execSync } = require("node:child_process");
  execSync(`tar xzf "${backupPath}" -C "${dir}"`, { stdio: "pipe" });
}

export function deleteBackup(serverId: string, backupId: string): void {
  const backup = getBackupById(backupId);
  if (!backup) return;
  const backupPath = path.join(config.backupsDir, backup.filename);
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }
  deleteBackupRow(backupId);
}

export function listBackups(serverId: string) {
  return getBackupsForServer(serverId);
}

export function getBackupPath(filename: string): string {
  const safe = path.basename(filename);
  return path.join(config.backupsDir, safe);
}
