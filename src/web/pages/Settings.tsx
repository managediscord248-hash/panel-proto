import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useAuth } from "../auth-context";
import { useTheme, applyThemeColor } from "../theme-context";
import { Save, KeyRound, Shield, Palette, Image as ImageIcon, Upload, Trash2, Check, Sparkles } from "lucide-react";
import { colorPresets } from "../colors";

export function Settings() {
  const { show } = useToast();
  const { user } = useAuth();
  const { refresh: refreshTheme } = useTheme();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    api.getSettings().then((r) => setSettings(r.settings)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        panel_name: settings.panel_name,
        panel_motd: settings.panel_motd,
        default_java: settings.default_java,
        default_memory: settings.default_memory,
        max_upload_mb: settings.max_upload_mb,
        registration_enabled: settings.registration_enabled ?? "1",
        theme_color: settings.theme_color || "#bf00ff",
        startup_animation: settings.startup_animation ?? "1",
      });
      await refreshTheme();
      show("Settings saved", "success");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      await api.uploadImage("logo", file);
      setSettings({ ...settings, logo_url: "/api/settings/image/logo" });
      await refreshTheme();
      show("Logo uploaded", "success");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      await api.uploadImage("bg", file);
      setSettings({ ...settings, bg_url: "/api/settings/image/bg" });
      await refreshTheme();
      show("Background uploaded", "success");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await api.removeImage("logo");
      setSettings({ ...settings, logo_url: "" });
      await refreshTheme();
      show("Logo removed", "success");
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleRemoveBg = async () => {
    try {
      await api.removeImage("bg");
      setSettings({ ...settings, bg_url: "" });
      await refreshTheme();
      show("Background removed", "success");
    } catch (err: any) {
      show(err.message, "error");
    }
  };

  const handleColorChange = (color: string) => {
    setSettings({ ...settings, theme_color: color });
    applyThemeColor(color);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-az-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Panel configuration</p>
      </div>

      {/* Appearance */}
      <form onSubmit={handleSave} className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5 text-az-400" />
          <h2 className="font-semibold text-slate-200">Appearance & Branding</h2>
        </div>

        <div>
          <label className="label">Panel Name</label>
          <input className="input" value={settings.panel_name || ""} onChange={(e) => setSettings({ ...settings, panel_name: e.target.value })} placeholder="My Panel" />
        </div>

        <div>
          <label className="label">Theme Color</label>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="color"
              className="w-12 h-10 rounded-lg bg-slate-950/50 border border-slate-800 cursor-pointer"
              value={settings.theme_color || "#bf00ff"}
              onChange={(e) => handleColorChange(e.target.value)}
            />
            <input
              className="input flex-1 min-w-[120px]"
              value={settings.theme_color || "#bf00ff"}
              onChange={(e) => handleColorChange(e.target.value)}
              placeholder="#bf00ff"
            />
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {colorPresets.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => handleColorChange(c.hex)}
                className={`relative h-9 rounded-lg transition-all ${settings.theme_color === c.hex ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-105" : "hover:scale-105 ring-1 ring-slate-700"}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {settings.theme_color === c.hex && (
                  <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Logo Image</label>
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-slate-700" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                <ImageIcon className="w-5 h-5 text-slate-600" />
              </div>
            )}
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" onChange={handleLogoUpload} className="hidden" />
            <button type="button" onClick={() => logoInputRef.current?.click()} className="btn btn-secondary" disabled={uploadingLogo}>
              {uploadingLogo ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Upload className="w-4 h-4" /> Upload</>}
            </button>
            {settings.logo_url && (
              <button type="button" onClick={handleRemoveLogo} className="btn btn-ghost text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">PNG, JPG, SVG, or WebP. Max 10MB.</p>
        </div>

        <div>
          <label className="label">Login Background Image</label>
          <div className="flex items-center gap-3">
            {settings.bg_url ? (
              <img src={settings.bg_url} alt="Background" className="w-20 h-12 rounded-lg object-cover border border-slate-700" />
            ) : (
              <div className="w-20 h-12 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                <ImageIcon className="w-5 h-5 text-slate-600" />
              </div>
            )}
            <input ref={bgInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp" onChange={handleBgUpload} className="hidden" />
            <button type="button" onClick={() => bgInputRef.current?.click()} className="btn btn-secondary" disabled={uploadingBg}>
              {uploadingBg ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Upload className="w-4 h-4" /> Upload</>}
            </button>
            {settings.bg_url && (
              <button type="button" onClick={handleRemoveBg} className="btn btn-ghost text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Shown behind the login and setup screens. Max 10MB.</p>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Settings</>}
        </button>
      </form>

      {/* Panel settings */}
      <form onSubmit={handleSave} className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-az-400" />
          <h2 className="font-semibold text-slate-200">Panel Settings</h2>
        </div>
        <div>
          <label className="label">Panel MOTD</label>
          <input className="input" value={settings.panel_motd || ""} onChange={(e) => setSettings({ ...settings, panel_motd: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Default Java</label>
            <select className="input" value={settings.default_java || "21"} onChange={(e) => setSettings({ ...settings, default_java: e.target.value })}>
              <option value="8">Java 8</option>
              <option value="11">Java 11</option>
              <option value="17">Java 17</option>
              <option value="21">Java 21</option>
            </select>
          </div>
          <div>
            <label className="label">Default Memory (MB)</label>
            <input className="input" type="number" value={settings.default_memory || "2048"} onChange={(e) => setSettings({ ...settings, default_memory: e.target.value })} />
          </div>
          <div>
            <label className="label">Max Upload (MB)</label>
            <input className="input" type="number" value={settings.max_upload_mb || "100"} onChange={(e) => setSettings({ ...settings, max_upload_mb: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.registration_enabled === "1"}
              onChange={(e) => setSettings({ ...settings, registration_enabled: e.target.checked ? "1" : "0" })}
              className="rounded border-slate-700 bg-slate-900 text-az-600 focus:ring-az-500"
            />
            Allow new user registration (Sign Up tab on login page)
          </label>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.startup_animation !== "0"}
              onChange={(e) => setSettings({ ...settings, startup_animation: e.target.checked ? "1" : "0" })}
              className="rounded border-slate-700 bg-slate-900 text-az-600 focus:ring-az-500"
            />
            <Sparkles className="w-4 h-4 text-az-400" />
            Show startup animation splash screen
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Save Settings</>}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-5 h-5 text-az-400" />
          <h2 className="font-semibold text-slate-200">Change Password</h2>
        </div>
        <div>
          <label className="label">Current Password</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={changingPwd}>
          {changingPwd ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Change Password"}
        </button>
      </form>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-200 mb-3">Your Account</h2>
        <div className="space-y-2 text-sm">
          <p className="text-slate-400">Username: <span className="text-slate-200">{user?.username}</span></p>
          <p className="text-slate-400">Role: <span className="text-slate-200 capitalize">{user?.role}</span></p>
          {user?.email && <p className="text-slate-400">Email: <span className="text-slate-200">{user.email}</span></p>}
        </div>
      </div>
    </div>
  );

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      show("Passwords do not match", "error");
      return;
    }
    setChangingPwd(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      show("Password changed", "success");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      show(err.message, "error");
    } finally {
      setChangingPwd(false);
    }
  }
}
