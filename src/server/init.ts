import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { runMigrations, getDb } from "./db.js";
import { getSettings, setSetting } from "./store.js";
import { createUser } from "./auth.js";
import { countUsers } from "./store.js";

export function initServer(): void {
  // Create directories
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.serversDir, { recursive: true });
  fs.mkdirSync(config.backupsDir, { recursive: true });

  // Run migrations
  runMigrations();

  // Generate JWT secret if not set and not in production
  if (config.jwtSecret === "az-panel-dev-secret-change-me" && process.env.NODE_ENV === "production") {
    const db = getDb();
    const existing = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get() as { value: string } | undefined;
    if (existing) {
      config.jwtSecret = existing.value;
    } else {
      const secret = randomBytes(48).toString("hex");
      setSetting("jwt_secret", secret);
      config.jwtSecret = secret;
    }
  }
}

export function isSetupComplete(): boolean {
  const settings = getSettings();
  return settings["panel_setup_complete"] === "1" && countUsers() > 0;
}

export async function completeSetup(panelName: string, username: string, password: string, email?: string, themeColor?: string): Promise<void> {
  setSetting("panel_name", panelName || "AZ PANEL");
  setSetting("panel_setup_complete", "1");
  if (themeColor) setSetting("theme_color", themeColor);
  await createUser(username, password, "owner", email);
}

export function getPanelName(): string {
  return getSettings()["panel_name"] || "AZ PANEL";
}
