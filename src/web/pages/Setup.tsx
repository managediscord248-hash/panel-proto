import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useTheme, applyThemeColor } from "../theme-context";
import { colorPresets } from "../colors";
import { useToast } from "../components/Toast";
import { motion } from "framer-motion";
import { Zap, Shield, User, Lock, Mail, Palette, Check } from "lucide-react";

export function Setup() {
  const navigate = useNavigate();
  const { panelName, logoUrl, bgUrl } = useTheme();
  const { show } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [customPanelName, setCustomPanelName] = useState(panelName);
  const [selectedColor, setSelectedColor] = useState("#bf00ff");

  useEffect(() => { setCustomPanelName(panelName); }, [panelName]);

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex);
    applyThemeColor(hex);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      show("Passwords do not match", "error");
      return;
    }
    if (password.length < 8) {
      show("Password must be at least 8 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await api.completeSetup({
        panelName: customPanelName,
        username,
        password,
        email: email || undefined,
        themeColor: selectedColor,
      });
      show("Setup complete! Please sign in.", "success");
      navigate("/login");
    } catch (err: any) {
      show(err.message || "Setup failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const bgStyle = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden" style={bgStyle}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-az-950/30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-az-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-lg"
      >
        <div className="text-center mb-6">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-xl" />
          ) : (
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-az-500 to-az-700 items-center justify-center shadow-xl shadow-az-600/30 mb-4">
              <Zap className="w-8 h-8 text-white" fill="white" />
            </div>
          )}
          <h1 className="text-3xl font-bold gradient-text">{customPanelName || "AZ PANEL"}</h1>
          <p className="text-slate-500 mt-2">Initial setup — create your admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="card bg-slate-900/80 p-7 space-y-4">
          <div>
            <label className="label">Panel Name</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                className="input pl-10"
                value={customPanelName}
                onChange={(e) => setCustomPanelName(e.target.value)}
                placeholder="AZ PANEL"
                required
              />
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="flex items-center gap-2 label">
              <Palette className="w-4 h-4" /> Theme Color
            </label>
            <div className="grid grid-cols-5 gap-2.5 mt-1">
              {colorPresets.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleColorSelect(c.hex)}
                  className={`relative h-12 rounded-xl transition-all duration-200 ${
                    selectedColor === c.hex
                      ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105"
                      : "hover:scale-105 ring-1 ring-slate-700"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {selectedColor === c.hex && (
                    <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Selected: <span className="text-slate-300 capitalize">{colorPresets.find((c) => c.hex === selectedColor)?.name || "Custom"}</span>
            </p>
          </div>

          <div>
            <label className="label">Admin Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                className="input pl-10"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                pattern="[a-zA-Z0-9_]{3,32}"
                title="3-32 chars: letters, numbers, underscore"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                className="input pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  className="input pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">Confirm</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  className="input pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
