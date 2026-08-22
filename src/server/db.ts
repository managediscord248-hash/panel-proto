import Database from "better-sqlite3";
import type { Database as DBType } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

let db: DBType;

export function getDb(): DBType {
  if (db) return db;
  fs.mkdirSync(config.dataDir, { recursive: true });
  const dbPath = path.join(config.dataDir, "azpanel.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

const migrations: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','user')),
        is_suspended INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        type TEXT NOT NULL DEFAULT 'minecraft',
        runtime TEXT NOT NULL DEFAULT 'local' CHECK (runtime IN ('local','docker')),
        status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('stopped','starting','running','stopping','crashed')),
        port INTEGER NOT NULL DEFAULT 25565,
        memory_mb INTEGER NOT NULL DEFAULT 2048,
        max_players INTEGER NOT NULL DEFAULT 20,
        java_version TEXT NOT NULL DEFAULT '21',
        game_version TEXT,
        loader TEXT DEFAULT 'vanilla',
        world_name TEXT DEFAULT 'world',
        motd TEXT,
        auto_start INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        started_at TEXT,
        pid INTEGER
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        action TEXT NOT NULL,
        target TEXT,
        detail TEXT,
        ip TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ok',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('panel_name', 'AZ PANEL'),
        ('panel_setup_complete', '0'),
        ('panel_motd', 'Welcome to your panel'),
        ('default_java', '21'),
        ('default_memory', '2048'),
        ('max_upload_mb', '100'),
        ('registration_enabled', '1'),
        ('theme_color', '#bf00ff'),
        ('logo_url', ''),
        ('bg_url', ''),
        ('startup_animation', '1');

      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'local' CHECK (type IN ('local','remote')),
        host TEXT,
        port INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS server_assignments (
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (server_id, user_id)
      );

      INSERT OR IGNORE INTO nodes (id, name, type) VALUES ('local', 'Local Node', 'local');
    `,
  },
];

export function runMigrations(): void {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = d.prepare("SELECT name FROM _migrations").all() as { name: string }[];
  const appliedSet = new Set(applied.map((r) => r.name));
  for (const m of migrations) {
    if (appliedSet.has(m.name)) continue;
    d.exec(m.sql);
    d.prepare("INSERT INTO _migrations (name) VALUES (?)").run(m.name);
  }
}

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  role: "owner" | "admin" | "user";
  is_suspended: number;
  created_at: string;
  last_login_at: string | null;
}

export interface ServerRow {
  id: string;
  name: string;
  type: string;
  runtime: "local" | "docker";
  status: string;
  port: number;
  memory_mb: number;
  max_players: number;
  java_version: string;
  game_version: string | null;
  loader: string | null;
  world_name: string | null;
  motd: string | null;
  auto_start: number;
  created_at: string;
  started_at: string | null;
  pid: number | null;
}

export interface SettingsRow {
  key: string;
  value: string;
}

export interface AuditRow {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface BackupRow {
  id: string;
  server_id: string;
  filename: string;
  size_bytes: number;
  status: string;
  created_at: string;
}

export interface NodeRow {
  id: string;
  name: string;
  type: "local" | "remote";
  host: string | null;
  port: number | null;
  enabled: number;
  created_at: string;
}

export interface ServerAssignmentRow {
  server_id: string;
  user_id: number;
  assigned_at: string;
}

export function getSettings(): Record<string, string> {
  const d = getDb();
  const rows = d.prepare("SELECT key, value FROM settings").all() as SettingsRow[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

export function audit(userId: number | null, username: string | null, action: string, target?: string, detail?: string, ip?: string): void {
  getDb().prepare("INSERT INTO audit_log (user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId, username, action, target ?? null, detail ?? null, ip ?? null
  );
}
