import { Router } from "express";
import { searchModrinth, getModrinthProject, getModrinthVersions, downloadMod } from "../modrinth.js";
import { logAction, type AuthedRequest, canAccessServer } from "../auth.js";
import { getServerById } from "../store.js";

export const modrinthRoutes = Router();

modrinthRoutes.get("/search", async (req: AuthedRequest, res) => {
  const query = (req.query.q as string) || "";
  const gameVersion = (req.query.game_version as string) || undefined;
  const loader = (req.query.loader as string) || undefined;
  const limit = parseInt((req.query.limit as string) || "20", 10);
  const offset = parseInt((req.query.offset as string) || "0", 10);
  try {
    const facets: Record<string, string[]> = {};
    if (gameVersion) facets["versions"] = [gameVersion];
    if (loader && loader !== "vanilla") facets["categories"] = [loader];
    const result = await searchModrinth(query, facets, limit, offset);
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

modrinthRoutes.get("/project/:slug", async (req: AuthedRequest, res) => {
  try {
    const project = await getModrinthProject(req.params.slug);
    res.json({ project });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

modrinthRoutes.get("/project/:slug/versions", async (req: AuthedRequest, res) => {
  const gameVersion = (req.query.game_version as string) || undefined;
  const loader = (req.query.loader as string) || undefined;
  try {
    const project = await getModrinthProject(req.params.slug);
    const versions = await getModrinthVersions(project.id, gameVersion, loader);
    res.json({ versions });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

modrinthRoutes.post("/install", async (req: AuthedRequest, res) => {
  const { serverId, fileUrl, filename, versionId, modsDir } = req.body;
  if (!serverId || !fileUrl || !filename) {
    return res.status(400).json({ error: "serverId, fileUrl, and filename required" });
  }
  const server = getServerById(serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, serverId)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  try {
    const result = await downloadMod(serverId, versionId, fileUrl, filename, modsDir || "mods");
    logAction(req, "install_mod", `${serverId}/${filename}`, `Size: ${result.size}`);
    res.json({ ok: true, size: result.size });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

modrinthRoutes.get("/installed/:serverId", (req: AuthedRequest, res) => {
  const server = getServerById(req.params.serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (!canAccessServer(req.user, req.params.serverId)) {
    return res.status(403).json({ error: "You do not have access to this server" });
  }
  const fs = require("node:fs");
  const path = require("node:path");
  const { serverDir } = require("../paths.js");
  const dir = serverDir(req.params.serverId);
  const modsDir = path.join(dir, "mods");
  if (!fs.existsSync(modsDir)) {
    return res.json({ mods: [] });
  }
  try {
    const files = fs.readdirSync(modsDir).filter((f: string) => f.endsWith(".jar"));
    const mods = files.map((f: string) => {
      const stat = fs.statSync(path.join(modsDir, f));
      return { filename: f, size: stat.size, modified: stat.mtime.toISOString() };
    });
    res.json({ mods });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
