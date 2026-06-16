import pino, { type Logger } from "pino";
import { config } from "./config.js";

const isTest = config.NODE_ENV === "test";
const isDev = config.NODE_ENV === "development";

export const logger: Logger = pino({
  level: isTest ? "silent" : config.LOG_LEVEL,
  base: { service: "aevum-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
        },
      }
    : {}),
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
