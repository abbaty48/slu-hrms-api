import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const translateTime =
  process.env.NODE_ENV === "production"
    ? "UTC:yyyy-mm-dd'T'HH:MM:ss.l'Z'"
    : "SYS:yyyy-mm-dd HH:MM:ss.l";

export default {
  level: process.env.LOG_LEVEL || "trace",
  base: null, // remove pid, hostname
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "authorization",
      "remotePort",
    ],
    censor: "[REDACTED]",
  },
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime,
        },
      },
      {
        target: "pino/file",
        options: {
          destination: join(
            dirname(fileURLToPath(import.meta.url)),
            "../logs/app-logs.log",
          ),
          mkdir: true,
        },
      },
    ],
  },
};
