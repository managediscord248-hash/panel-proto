import { getDb, type UserRow, type ServerRow, type SettingsRow, type AuditRow, type BackupRow, type NodeRow, type ServerAssignmentRow, setSetting, getSettings, audit } from "./db.js";

export { getDb, setSetting, getSettings, audit };
export type { UserRow, ServerRow, SettingsRow, AuditRow, BackupRow, NodeRow, ServerAssignmentRow };

export function getUserByUsername(username: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as UserRow | undefined;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getAllUsers(): UserRow[] {
  return getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[];
}

export function updateUserLastLogin(id: number): void {
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteUser(id: number): void {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

export function setUserSuspended(id: number, suspended: boolean): void {
  getDb().prepare("UPDATE users SET is_suspended = ? WHERE id = ?").run(suspended ? 1 : 0, id);
}

export function updateUserRole(id: number, role: "owner" | "admin" | "user"): void {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function updateUserPassword(id: number, hash: string): void {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
}

export function countUsers(): number {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  return row.c;
}

export function getServerById(id: string): ServerRow | undefined {
  return getDb().prepare("SELECT * FROM servers WHERE id = ?").get(id) as ServerRow | undefined;
}

export function getServerByName(name: string): ServerRow | undefined {
  return getDb().prepare("SELECT * FROM servers WHERE name = ? COLLATE NOCASE").get(name) as ServerRow | undefined;
}

export function getAllServers(): ServerRow[] {
  return getDb().prepare("SELECT * FROM servers ORDER BY created_at DESC").all() as ServerRow[];
}

export function insertServer(s: Partial<ServerRow> & { id: string; name: string }): void {
  getDb().prepare(`
    INSERT INTO servers (id, name, type, runtime, status, port, memory_mb, max_players, java_version, game_version, loader, world_name, motd, auto_start)
    VALUES (@id, @name, @type, @runtime, @status, @port, @memory_mb, @max_players, @java_version, @game_version, @loader, @world_name, @motd, @auto_start)
  `).run({
    id: s.id,
    name: s.name,
    type: s.type ?? "minecraft",
    runtime: s.runtime ?? "local",
    status: s.status ?? "stopped",
    port: s.port ?? 25565,
    memory_mb: s.memory_mb ?? 2048,
    max_players: s.max_players ?? 20,
    java_version: s.java_version ?? "21",
    game_version: s.game_version ?? null,
    loader: s.loader ?? "vanilla",
    world_name: s.world_name ?? "world",
    motd: s.motd ?? null,
    auto_start: s.auto_start ?? 0,
  });
}

export function updateServer(id: string, fields: Partial<ServerRow>): void {
  const current = getServerById(id);
  if (!current) return;
  const merged = { ...current, ...fields };
  getDb().prepare(`
    UPDATE servers SET
      name = ?, type = ?, runtime = ?, status = ?, port = ?, memory_mb = ?,
      max_players = ?, java_version = ?, game_version = ?, loader = ?,
      world_name = ?, motd = ?, auto_start = ?, started_at = ?, pid = ?
    WHERE id = ?
  `).run(
    merged.name, merged.type, merged.runtime, merged.status, merged.port, merged.memory_mb,
    merged.max_players, merged.java_version, merged.game_version, merged.loader,
    merged.world_name, merged.motd, merged.auto_start, merged.started_at, merged.pid, id
  );
}

export function deleteServerRow(id: string): void {
  getDb().prepare("DELETE FROM servers WHERE id = ?").run(id);
}

export function getBackupsForServer(serverId: string): BackupRow[] {
  return getDb().prepare("SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC").all(serverId) as BackupRow[];
}

export function insertBackup(b: Partial<BackupRow> & { id: string; server_id: string; filename: string }): void {
  getDb().prepare("INSERT INTO backups (id, server_id, filename, size_bytes, status) VALUES (?, ?, ?, ?, ?)").run(
    b.id, b.server_id, b.filename, b.size_bytes ?? 0, b.status ?? "ok"
  );
}

export function getBackupById(id: string): BackupRow | undefined {
  return getDb().prepare("SELECT * FROM backups WHERE id = ?").get(id) as BackupRow | undefined;
}

export function deleteBackupRow(id: string): void {
  getDb().prepare("DELETE FROM backups WHERE id = ?").run(id);
}

export function getAuditLog(limit = 100, offset = 0): AuditRow[] {
  return getDb().prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset) as AuditRow[];
}

export function getAuditCount(): number {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM audit_log").get() as { c: number };
  return row.c;
}

// ─── Nodes ───

export function getAllNodes(): NodeRow[] {
  return getDb().prepare("SELECT * FROM nodes ORDER BY type ASC, created_at ASC").all() as NodeRow[];
}

export function getNodeById(id: string): NodeRow | undefined {
  return getDb().prepare("SELECT * FROM nodes WHERE id = ?").get(id) as NodeRow | undefined;
}

export function getNodeByName(name: string): NodeRow | undefined {
  return getDb().prepare("SELECT * FROM nodes WHERE name = ? COLLATE NOCASE").get(name) as NodeRow | undefined;
}

export function insertNode(n: Partial<NodeRow> & { id: string; name: string }): void {
  getDb().prepare("INSERT INTO nodes (id, name, type, host, port, enabled) VALUES (?, ?, ?, ?, ?, ?)").run(
    n.id, n.name, n.type ?? "remote", n.host ?? null, n.port ?? null, n.enabled ?? 1
  );
}

export function updateNode(id: string, fields: Partial<NodeRow>): void {
  const current = getNodeById(id);
  if (!current) return;
  const merged = { ...current, ...fields };
  getDb().prepare("UPDATE nodes SET name = ?, type = ?, host = ?, port = ?, enabled = ? WHERE id = ?").run(
    merged.name, merged.type, merged.host, merged.port, merged.enabled, id
  );
}

export function deleteNodeRow(id: string): void {
  getDb().prepare("DELETE FROM nodes WHERE id = ?").run(id);
}

// ─── Server Assignments ───

export function getAssignmentsForServer(serverId: string): number[] {
  const rows = getDb().prepare("SELECT user_id FROM server_assignments WHERE server_id = ?").all(serverId) as { user_id: number }[];
  return rows.map((r) => r.user_id);
}

export function getAssignedServerIdsForUser(userId: number): string[] {
  const rows = getDb().prepare("SELECT server_id FROM server_assignments WHERE user_id = ?").all(userId) as { server_id: string }[];
  return rows.map((r) => r.server_id);
}

export function isServerAssignedToUser(serverId: string, userId: number): boolean {
  const row = getDb().prepare("SELECT 1 FROM server_assignments WHERE server_id = ? AND user_id = ?").get(serverId, userId);
  return !!row;
}

export function setServerAssignments(serverId: string, userIds: number[]): void {
  const db = getDb();
  db.prepare("DELETE FROM server_assignments WHERE server_id = ?").run(serverId);
  const stmt = db.prepare("INSERT OR IGNORE INTO server_assignments (server_id, user_id) VALUES (?, ?)");
  for (const uid of userIds) {
    stmt.run(serverId, uid);
  }
}

export function deleteAssignmentsForServer(serverId: string): void {
  getDb().prepare("DELETE FROM server_assignments WHERE server_id = ?").run(serverId);
}
