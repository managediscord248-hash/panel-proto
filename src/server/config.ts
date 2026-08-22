import path from "node:path";

export interface PanelConfig {
  port: number;
  dataDir: string;
  serversDir: string;
  backupsDir: string;
  jwtSecret: string;
  corsOrigin: string;
  dockerRuntime: boolean;
  dockerImage: string;
  defaultMemoryMb: number;
  consoleLineLimit: number;
  maxUploadMb: number;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const dataDir = process.env.AZ_DATA_DIR || path.join(process.cwd(), "data");
const serversDir = process.env.AZ_SERVERS_DIR || path.join(dataDir, "servers");
const backupsDir = process.env.AZ_BACKUPS_DIR || path.join(dataDir, "backups");

export const config: PanelConfig = {
  port: envInt("PORT", 7777),
  dataDir,
  serversDir,
  backupsDir,
  jwtSecret: process.env.AZ_JWT_SECRET || "az-panel-dev-secret-change-me",
  corsOrigin: process.env.AZ_CORS_ORIGIN || "*",
  dockerRuntime: process.env.AZ_DOCKER === "1" || process.env.AZ_DOCKER === "true",
  dockerImage: process.env.AZ_DOCKER_IMAGE || "eclipse-temurin:21-jre",
  defaultMemoryMb: envInt("AZ_DEFAULT_MEMORY_MB", 2048),
  consoleLineLimit: envInt("AZ_CONSOLE_LINES", 1000),
  maxUploadMb: envInt("AZ_MAX_UPLOAD_MB", 100),
};
