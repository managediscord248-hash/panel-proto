import { Router } from "express";
import { isSetupComplete, completeSetup } from "../init.js";
import { validateUsername, validateServerName } from "../paths.js";

export const setupRoutes = Router();

setupRoutes.get("/status", (_req, res) => {
  res.json({ setupComplete: isSetupComplete() });
});

setupRoutes.post("/complete", async (req, res) => {
  if (isSetupComplete()) {
    return res.status(400).json({ error: "Setup already complete" });
  }
  const { panelName, username, password, email, themeColor } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  if (!validateUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-32 chars, alphanumeric/underscore" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  try {
    await completeSetup(panelName, username, password, email, themeColor);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
