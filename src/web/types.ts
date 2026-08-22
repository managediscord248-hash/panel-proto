export interface User {
  id: number;
  username: string;
  role: "owner" | "admin" | "user";
  email: string | null;
  isSuspended?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface Server {
  id: string;
  name: string;
  type: string;
  runtime: "local" | "docker";
  status: "stopped" | "starting" | "running" | "stopping" | "crashed";
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
  is_running: boolean;
  current_status: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  extension?: string;
}

export interface Backup {
  id: string;
  server_id: string;
  filename: string;
  size_bytes: number;
  status: string;
  created_at: string;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  project_type: string;
  versions: string[];
  categories: string[];
  server_side: string;
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: { url: string; filename: string; primary: boolean; size: number }[];
}

export interface SystemStats {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  cpuCores: number;
  cpuUsage: number;
  memTotal: number;
  memUsed: number;
  memFree: number;
  memUsagePercent: number;
  diskTotal: number;
  diskUsed: number;
  diskFree: number;
  diskUsagePercent: number;
  loadAvg: number[];
  kernel: string;
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface Node {
  id: string;
  name: string;
  type: "local" | "remote";
  host: string | null;
  port: number | null;
  enabled: boolean;
  isLocal: boolean;
  created_at: string;
  serverCount?: number;
  cpuUsage?: number | null;
  memTotal?: number | null;
  memUsed?: number | null;
  diskTotal?: number | null;
  diskUsed?: number | null;
  cpuCores?: number | null;
}

export interface PlayerEntry {
  name: string;
  uuid?: string;
  expires?: string | null;
  reason?: string | null;
}

export interface PlayerData {
  online: string[];
  banned: PlayerEntry[];
  bannedIps: PlayerEntry[];
  whitelist: PlayerEntry[];
  ops: PlayerEntry[];
  isRunning: boolean;
}

export interface ServerProperties {
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
