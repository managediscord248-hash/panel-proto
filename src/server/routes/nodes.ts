import { Router } from "express";
import { randomUUID } from "node:crypto";
import os from "node:os";
import { getAllNodes, getNodeById, getNodeByName, insertNode, updateNode, deleteNodeRow, getAllServers } from "../store.js";
import { logAction, type AuthedRequest, requireRole } from "../auth.js";
import { validateServerName } from "../paths.js";

export const nodeRoutes = Router();

function toPublicNode(n: any) {
  return {
    id: n.id,
    name: n.name,
    type: n.type,
    host: n.type === "local" ? null : n.host,
    port: n.type === "local" ? null : n.port,
    enabled: n.enabled === 1,
    isLocal: n.id === "local",
    created_at: n.created_at,
  };
}

nodeRoutes.get("/", requireRole("owner", "admin"), (req: AuthedRequest, res) => {
  const nodes = getAllNodes();
  const servers = getAllServers();
  const result = nodes.map((n) => {
    const serverCount = servers.filter((s) => s.runtime === (n.type === "local" ? "local" : "docker")).length;
    let cpuUsage = 0;
    let memTotal = 0;
    let memUsed = 0;
    let diskTotal = 0;
    let diskUsed = 0;
    if (n.id === "local") {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      memTotal = totalMem;
      memUsed = totalMem - freeMem;
      cpuUsage = Math.min((os.loadavg()[0] / os.cpus().length) * 100, 100);
      try {
        const { execSync } = require("node:child_process");
        const df = execSync("df -B1 /", { encoding: "utf-8" }).trim().split("\n");
        if (df.length >= 2) {
          const parts = df[1].split(/\s+/);
          diskTotal = parseInt(parts[1], 10) || 0;
          diskUsed = diskTotal - (parseInt(parts[3], 10) || 0);
        }
      } catch { /* ignore */ }
    }
    return {
      ...toPublicNode(n),
      serverCount,
      cpuUsage: n.id === "local" ? cpuUsage : null,
      memTotal: n.id === "local" ? memTotal : null,
      memUsed: n.id === "local" ? memUsed : null,
      diskTotal: n.id === "local" ? diskTotal : null,
      diskUsed: n.id === "local" ? diskUsed : null,
      cpuCores: n.id === "local" ? os.cpus().length : null,
    };
  });
  res.json({ nodes: result });
});

nodeRoutes.post("/", requireRole("owner"), (req: AuthedRequest, res) => {
  const { name, host, port } = req.body;
  if (!name || !validateServerName(name)) {
    return res.status(400).json({ error: "Invalid node name (2-63 chars, alphanumeric, dash, underscore)" });
  }
  if (getNodeByName(name)) {
    return res.status(409).json({ error: "Node name already exists" });
  }
  const id = randomUUID();
  insertNode({ id, name, type: "remote", host: host || null, port: port ? parseInt(port, 10) : null, enabled: 1 });
  logAction(req, "create_node", name);
  res.json({ node: toPublicNode(getNodeById(id)) });
});

nodeRoutes.patch("/:id", requireRole("owner"), (req: AuthedRequest, res) => {
  const node = getNodeById(req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (node.id === "local") {
    return res.status(400).json({ error: "Local Node is protected and cannot be modified" });
  }
  const { name, host, port, enabled } = req.body;
  if (name && name !== node.name) {
    if (!validateServerName(name)) return res.status(400).json({ error: "Invalid node name" });
    if (getNodeByName(name)) return res.status(409).json({ error: "Name already exists" });
  }
  updateNode(node.id, {
    name: name || node.name,
    host: host !== undefined ? host : node.host,
    port: port !== undefined ? (port ? parseInt(port, 10) : null) : node.port,
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : node.enabled,
  });
  logAction(req, "update_node", node.name);
  res.json({ node: toPublicNode(getNodeById(node.id)) });
});

nodeRoutes.delete("/:id", requireRole("owner"), (req: AuthedRequest, res) => {
  const node = getNodeById(req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (node.id === "local") {
    return res.status(400).json({ error: "Local Node is protected and cannot be deleted" });
  }
  deleteNodeRow(node.id);
  logAction(req, "delete_node", node.name);
  res.json({ ok: true });
});

nodeRoutes.post("/:id/toggle", requireRole("owner"), (req: AuthedRequest, res) => {
  const node = getNodeById(req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (node.id === "local") {
    return res.status(400).json({ error: "Local Node cannot be disabled" });
  }
  updateNode(node.id, { enabled: node.enabled === 1 ? 0 : 1 });
  logAction(req, "toggle_node", node.name, node.enabled === 1 ? "disabled" : "enabled");
  res.json({ node: toPublicNode(getNodeById(node.id)) });
});
