import { createApp } from "./app.js";
import { config } from "./config.js";
import { processManager } from "./process-manager.js";
import { getAllServers } from "./store.js";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[AZ PANEL] Server running on port ${config.port}`);
  // Auto-start servers with auto_start flag
  const autoStartServers = getAllServers().filter(s => s.auto_start === 1);
  for (const s of autoStartServers) {
    console.log(`[AZ PANEL] Auto-starting server: ${s.name}`);
    processManager.startServer(s.id);
  }
});

process.on("SIGTERM", () => {
  console.log("[AZ PANEL] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[AZ PANEL] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});
