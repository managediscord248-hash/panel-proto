import { Router } from "express";
import { createBackup, restoreBackup, deleteBackup, listBackups, getBackupPath } from "../backups.js";
import { getServerById } from "../store.js";
import { logAction, type AuthedRequest, requireRole, canAccessServer } from "../auth.js";
import path from "node:path";

export const backupRoutes = Router();

function checkAccess(req: AuthedRequest, res: any): boolean {
  const server = getServerById(req.params.serverId);
  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return false;
  }
  if (!canAccessServer(req.user, req.params.serverId)) {
    res.status(403).json({ error: "You do not have access to this server" });
    return false;
  }
  return true;
}

backupRoutes.get("/:serverId", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const backups = listBackups(req.params.serverId);
  res.json({ backups });
});

backupRoutes.post("/:serverId", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const server = getServerById(req.params.serverId)!;
  try {
    const result = createBackup(server.id, server.name);
    logAction(req, "create_backup", server.name, result.filename);
    res.json({ backup: { id: result.id, filename: result.filename, size: result.size } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

backupRoutes.post("/:serverId/:backupId/restore", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const server = getServerById(req.params.serverId)!;
  try {
    restoreBackup(server.id, req.params.backupId);
    logAction(req, "restore_backup", server.name, req.params.backupId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

backupRoutes.delete("/:serverId/:backupId", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const server = getServerById(req.params.serverId)!;
  try {
    deleteBackup(server.id, req.params.backupId);
    logAction(req, "delete_backup", server.name, req.params.backupId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

backupRoutes.get("/:serverId/:backupId/download", (req: AuthedRequest, res) => {
  if (!checkAccess(req, res)) return;
  const server = getServerById(req.params.serverId)!;
  const backups = listBackups(server.id);
  const backup = backups.find((b) => b.id === req.params.backupId);
  if (!backup) return res.status(404).json({ error: "Backup not found" });
  const backupPath = getBackupPath(backup.filename);
  const fs = require("node:fs");
  if (!fs.existsSync(backupPath)) return res.status(404).json({ error: "Backup file missing" });
  res.download(backupPath, backup.filename);
});
