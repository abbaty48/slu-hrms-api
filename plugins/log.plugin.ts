import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance } from "fastify";

interface LogEntry {
  id: string;
  timestamp: number;
  level: string;
  msg: string;
  reqId?: string;
  req?: any;
  res?: any;
  responseTime?: number;
  [key: string]: any;
}

// In‑memory store
const logsStore = new Map<string, LogEntry>();
let nextId = 0;
let lastFilePos = 0;

// SSE clients
const clients = new Set<
  (log: LogEntry | { type: "delete" | "new"; id: string }) => void
>();

// Broadcast to all SSE clients
function broadcast(event: "new" | "delete", payload: any) {
  for (const send of clients) {
    send({ type: event, id: payload });
  }
}

// Parse a log line and add to store
function addLogEntry(line: string) {
  try {
    const parsed = JSON.parse(line);
    const id = `${parsed.time || Date.now()}_${nextId++}`;
    const entry: LogEntry = {
      id,
      timestamp: parsed.time || Date.now(),
      level:
        parsed.level === 30
          ? "info"
          : parsed.level === 40
            ? "warn"
            : parsed.level === 50
              ? "error"
              : "debug",
      msg: parsed.msg || "",
      ...parsed,
    };
    logsStore.set(id, entry);
    broadcast("new", entry);
  } catch (err) {
    // ignore non‑JSON lines
  }
}

// Initial load of the log file
async function loadExistingLogs(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream });
  for await (const line of rl) {
    if (line.trim()) addLogEntry(line);
  }
  // store current size for tailing
  const stats = fs.statSync(filePath);
  lastFilePos = stats.size;
}

// Tail the log file (polling every 500ms for simplicity)
function tailLogFile(filePath: string) {
  setInterval(() => {
    if (!fs.existsSync(filePath)) return;
    const stats = fs.statSync(filePath);
    if (stats.size > lastFilePos) {
      const stream = fs.createReadStream(filePath, {
        start: lastFilePos,
        encoding: "utf8",
      });
      let leftover = "";
      stream.on("data", (chunk: string) => {
        const lines = (leftover + chunk).split("\n");
        leftover = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) addLogEntry(line);
        }
      });
      stream.on("end", () => {
        if (leftover.trim()) addLogEntry(leftover);
      });
      lastFilePos = stats.size;
    }
  }, 500);
}

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const logFilePath = path.join("logs", "app-logs.log");
  // Load existing logs and start tailing
  await loadExistingLogs(logFilePath);
  tailLogFile(logFilePath);

  // ── SSE Logs Stream ─────────────────────────────────────────
  fastify.get("/logs/stream", async (req, reply) => {
    // Verify JWT from query parameter (SSE cannot set headers easily)
    const token = (req.query as any).token;
    if (!token) return reply.code(401).send({ error: "Missing token" });
    try {
      fastify.jwt.verify(token);
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    reply.raw.flushHeaders();

    // Send all existing logs first
    const allLogs = Array.from(logsStore.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    reply.raw.write(
      `data: ${JSON.stringify({ type: "init", logs: allLogs })}\n\n`,
    );
    reply.raw.flushHeaders();

    // Register this client
    const sendToClient = (event: any) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      reply.raw.flushHeaders();
    };
    clients.add(sendToClient);

    // Cleanup on disconnect
    req.raw.on("close", () => {
      clients.delete(sendToClient);
      fastify.log.info("Logs SSE client disconnected");
    });
  });

  // ── Delete single log ───────────────────────────────────────
  fastify.delete("/logs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!logsStore.has(id))
      return reply.code(404).send({ error: "Log not found" });
    logsStore.delete(id);
    broadcast("delete", id);
    return reply.code(204).send();
  });

  // ── Bulk delete (by IDs) ───────────────────────────────────
  fastify.delete("/logs", async (req, reply) => {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids))
      return reply.code(400).send({ error: "ids must be an array" });
    for (const id of ids) {
      if (logsStore.has(id)) {
        logsStore.delete(id);
        broadcast("delete", id);
      }
    }
    return reply.code(204).send();
  });

  // ── Serve Logs UI (HTML) ───────────────────────────────────
  const uiHtml = fs.readFileSync(path.join("views", "logs-ui.html"), "utf-8");
  fastify.get("/logs/ui", async (_, reply) => {
    reply.header("Content-Type", "text/html").send(uiHtml);
  });

  fastify.log.info(
    "logs: plugin ready — /logs/ui, /logs/stream, /auth/login, DELETE /logs/:id",
  );
});
