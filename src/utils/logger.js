import pino from "pino";
import { env } from "../config/environment.js";

class Logger {
  instance;
  logger;
  isProd;

  constructor() {
    this.isProd = env.NODE_ENV === "PROD";

    this.logger = pino({
      level: env.LOG_LEVEL || "info",
      base: { pid: false },
      transport: !this.isProd
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "yyyy-mm-dd HH:MM:ss",
              ignore: "pid,hostname", // Hide pid & hostname
            },
            worker: { autoEnd: true },
          }
        : undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: {
        err: pino.stdSerializers.err,
      },
    });
  }

  static getInstance() {
    if (!Logger.instance) Logger.instance = new Logger();
    return Logger.instance;
  }

  info(...args) {
    this.logger.info(...args);
  }

  error(...args) {
    this.logger.error(...args);
  }

  warn(...args) {
    this.logger.warn(...args);
  }

  close() {
    this.logger.flush();
  }
}

export const logger = Logger.getInstance();
