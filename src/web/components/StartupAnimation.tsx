import { useEffect, useState } from "react";
import { useTheme } from "../theme-context";
import { Zap } from "lucide-react";

export function StartupAnimation() {
  const { panelName, logoUrl } = useTheme();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="startup-overlay">
      <div className="startup-logo">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover" />
        ) : (
          <div
            className="inline-flex w-20 h-20 rounded-2xl items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--az-500), var(--az-700))",
              boxShadow: "0 0 40px rgba(var(--az-glow), 0.5)",
            }}
          >
            <Zap className="w-10 h-10 text-white" fill="white" />
          </div>
        )}
      </div>
      <h1
        className="text-3xl font-bold mt-6 neon-text"
        style={{ color: "var(--az-400)" }}
      >
        {panelName || "AZ Panel V1"}
      </h1>
      <p className="text-slate-500 text-sm mt-2 tracking-widest uppercase">Initializing</p>
      <div className="startup-bar">
        <div className="startup-bar-fill" />
      </div>
    </div>
  );
}
