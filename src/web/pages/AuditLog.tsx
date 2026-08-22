import { useEffect, useState } from "react";
import { api } from "../api";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditEntry } from "../types";

export function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    setLoading(true);
    api.getAuditLog(limit, page * limit).then((r) => {
      setLogs(r.logs);
      setTotal(r.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  const actionColors: Record<string, string> = {
    login: "text-az-400",
    logout: "text-slate-400",
    create_server: "text-emerald-400",
    delete_server: "text-red-400",
    start_server: "text-emerald-400",
    stop_server: "text-amber-400",
    kill_server: "text-red-400",
    restart_server: "text-amber-400",
    create_user: "text-emerald-400",
    delete_user: "text-red-400",
    suspend_user: "text-amber-400",
    update_role: "text-az-400",
    create_backup: "text-emerald-400",
    restore_backup: "text-az-400",
    delete_backup: "text-red-400",
    install_mod: "text-emerald-400",
    update_settings: "text-az-400",
    change_password: "text-amber-400",
    reset_password: "text-amber-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Audit Log</h1>
        <p className="text-slate-500 text-sm mt-1">{total} total entries</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center">
          <ScrollText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No audit entries</p>
        </div>
      ) : (
        <>
          <div className="card divide-y divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${actionColors[log.action] || "text-slate-300"}`}>
                      {log.action.replace(/_/g, " ")}
                    </span>
                    {log.target && <span className="text-xs text-slate-500">→ {log.target}</span>}
                  </div>
                  {log.detail && <p className="text-xs text-slate-500 mt-0.5">{log.detail}</p>}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                    <span>{log.username || "system"}</span>
                    {log.ip && <span>· {log.ip}</span>}
                    <span>· {new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-slate-400">Page {page + 1} of {totalPages}</span>
              <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
