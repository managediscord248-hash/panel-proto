import { Router } from "express";
import { getSystemStats, getInstalledJavaVersions } from "../system.js";
import { getAuditLog, getAuditCount } from "../store.js";
import { requireRole, type AuthedRequest } from "../auth.js";

export const systemRoutes = Router();

systemRoutes.get("/stats", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const stats = getSystemStats();
  res.json({ stats });
});

systemRoutes.get("/java", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const versions = getInstalledJavaVersions();
  res.json({ versions });
});

systemRoutes.get("/audit", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const limit = parseInt((req.query.limit as string) || "100", 10);
  const offset = parseInt((req.query.offset as string) || "0", 10);
  const logs = getAuditLog(limit, offset);
  const total = getAuditCount();
  res.json({ logs, total });
});
