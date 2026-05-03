import pino from "pino";

/**
 * Process-wide structured logger.
 *
 * - Writes JSON lines to stdout (12-factor; container platforms own log
 *   shipping). No file/transport config here on purpose.
 * - Level via `LOG_LEVEL` env var, defaults to `info` (or `debug` outside
 *   production for dev ergonomics).
 * - `.server.ts` suffix keeps Remix from including pino in the client bundle.
 */
const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  base: {
    service: "give-evidence",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
