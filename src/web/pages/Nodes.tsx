import { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../auth-context";
import { useToast } from "../components/Toast";
import { Modal, ConfirmDialog, formatBytes } from "../components/ui";
import { motion } from "framer-motion";
import { Network, Plus, Trash2, Power, Cpu, MemoryStick, HardDrive, Server, MapPin } from "lucide-react";
import type { Node } from "../types";

export function Nodes() {
  const { user } = useAuth();
  const { show } = useToast();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newHost, setNewHost] = useState("");
  const [newPort, setNewPort] = useState("");

  const load = () => {
    api.getNodes().then((r) => setNodes(r.nodes)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createNode({ name: newName, host: newHost || undefined, port: newPort ? parseInt(newPort, 10) : undefined });
      show("Node created", "success");
      setShowAdd(false);
      setNewName("");
      setNewHost("");
      setNewPort("");
      load();
    } catch (err: any) {
      show(err.message || "Failed to create node", "error");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleNode(id);
      load();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteNode(confirmDelete);
      show("Node deleted", "success");
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Nodes</h1>
          <p className="text-slate-500 text-sm mt-1">Manage compute nodes for your servers</p>
        </div>
        {user?.role === "owner" && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Node
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map((node, i) => (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="card p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                  background: "rgba(var(--az-glow), 0.1)",
                  boxShadow: "0 0 10px rgba(var(--az-glow), 0.1)",
                }}>
                  <Network className="w-5 h-5" style={{ color: "var(--az-400)" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{node.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge ${node.isLocal ? "badge-blue" : node.enabled ? "badge-green" : "badge-slate"}`}>
                      {node.isLocal ? "[LOCAL]" : "[REMOTE]"}
                    </span>
                    {!node.isLocal && (
                      <span className={`badge ${node.enabled ? "badge-green" : "badge-slate"}`}>
                        {node.enabled ? "Online" : "Disabled"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {node.type === "remote" && node.host && (
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                <MapPin className="w-3.5 h-3.5" />
                <span>{node.host}{node.port ? `:${node.port}` : ""}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Servers</p>
                <p className="text-slate-200 font-medium flex items-center gap-1">
                  <Server className="w-3.5 h-3.5" /> {node.serverCount ?? 0}
                </p>
              </div>
              {node.cpuUsage !== null && node.cpuUsage !== undefined && (
                <div>
                  <p className="text-slate-500 text-xs">CPU</p>
                  <p className="text-slate-200 font-medium flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5" /> {node.cpuUsage.toFixed(1)}%
                  </p>
                </div>
              )}
              {node.memTotal !== null && node.memTotal !== undefined && (
                <div>
                  <p className="text-slate-500 text-xs">Memory</p>
                  <p className="text-slate-200 font-medium flex items-center gap-1">
                    <MemoryStick className="w-3.5 h-3.5" /> {formatBytes(node.memUsed ?? 0)} / {formatBytes(node.memTotal ?? 0)}
                  </p>
                </div>
              )}
              {node.diskTotal !== null && node.diskTotal !== undefined && (
                <div>
                  <p className="text-slate-500 text-xs">Disk</p>
                  <p className="text-slate-200 font-medium flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5" /> {formatBytes(node.diskUsed ?? 0)} / {formatBytes(node.diskTotal ?? 0)}
                  </p>
                </div>
              )}
            </div>

            {!node.isLocal && user?.role === "owner" && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800/80">
                <button
                  className="btn btn-secondary text-xs flex-1 justify-center"
                  onClick={() => handleToggle(node.id)}
                >
                  <Power className="w-3.5 h-3.5" /> {node.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  className="btn btn-danger text-xs"
                  onClick={() => setConfirmDelete(node.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <Modal open={showAdd} title="Add Remote Node" onClose={() => setShowAdd(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="label">Node Name</label>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-remote-node"
              pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}"
              required
            />
          </div>
          <div>
            <label className="label">Host (optional)</label>
            <input
              className="input"
              value={newHost}
              onChange={(e) => setNewHost(e.target.value)}
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="label">Port (optional)</label>
            <input
              type="number"
              className="input"
              value={newPort}
              onChange={(e) => setNewPort(e.target.value)}
              placeholder="22"
            />
          </div>
          <button type="submit" className="btn btn-primary w-full justify-center">Create Node</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Node"
        message="Are you sure you want to delete this node? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
