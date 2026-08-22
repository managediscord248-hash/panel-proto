import express from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";
import { initServer, isSetupComplete } from "./init.js";
import { requireAuth, requireRole, type AuthedRequest } from "./auth.js";
import { logAction } from "./auth.js";
import { authRoutes } from "./routes/auth.js";
import { serverRoutes } from "./routes/servers.js";
import { fileRoutes } from "./routes/files.js";
import { backupRoutes } from "./routes/backups.js";
import { modrinthRoutes } from "./routes/modrinth.js";
import { systemRoutes } from "./routes/system.js";
import { userRoutes } from "./routes/users.js";
import { settingsRoutes } from "./routes/settings.js";
import { setupRoutes } from "./routes/setup.js";
import { nodeRoutes } from "./routes/nodes.js";
import { playerRoutes } from "./routes/players.js";
import { optionsRoutes } from "./routes/options.js";

export function createApp(): express.Express {
  initServer();
  const app = express();

  app.use(compression());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "16mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting for auth
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", apiLimiter);

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", setup: isSetupComplete(), version: "1.0.0" });
  });

  // Kubernetes-style health check (no auth)
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", setup: isSetupComplete(), version: "1.0.0" });
  });
  app.get("/api/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", setup: isSetupComplete(), version: "1.0.0" });
  });

  // Setup routes (no auth)
  app.use("/api/setup", setupRoutes);

  // Auth routes (with auth limiter)
  app.use("/api/auth", authLimiter, authRoutes);

  // Protected routes
  app.use("/api/servers", requireAuth, serverRoutes);
  app.use("/api/files", requireAuth, fileRoutes);
  app.use("/api/backups", requireAuth, backupRoutes);
  app.use("/api/modrinth", requireAuth, modrinthRoutes);
  app.use("/api/system", requireAuth, systemRoutes);
  app.use("/api/users", requireAuth, userRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/nodes", requireAuth, nodeRoutes);
  app.use("/api/servers", requireAuth, playerRoutes);
  app.use("/api/servers", requireAuth, optionsRoutes);

  // Serve static frontend in production
  const webDir = path.join(process.cwd(), "dist", "web");
  if (fs.existsSync(webDir)) {
    app.use(express.static(webDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(webDir, "index.html"));
    });
  }

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[ERROR]", err.message);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large" });
    }
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON" });
    }
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}
