import { EventEmitter } from "node:events";
import { processManager } from "./process-manager.js";

class ConsoleStream extends EventEmitter {
  private clients = new Map<string, Set<(line: string) => void>>();

  addClient(serverId: string, cb: (line: string) => void): () => void {
    if (!this.clients.has(serverId)) {
      this.clients.set(serverId, new Set());
    }
    this.clients.get(serverId)!.add(cb);
    const unsub = processManager.subscribeConsole(serverId, cb);
    return () => {
      this.clients.get(serverId)?.delete(cb);
      unsub();
    };
  }
}

export const consoleStream = new ConsoleStream();
