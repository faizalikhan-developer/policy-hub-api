import { App } from "./app.js";
import { databaseConnection } from "./database/index.js";
import { logger } from "./utils/logger.js";
import "./utils/agenda.js";
import { CPUMonitor } from "./utils/cpu.monitor.js";
import { isMainThread } from "worker_threads";

class Server {
  #app;
  #isShuttingDown = false;
  #cpuMonitor;

  constructor() {
    this.#app = new App();
    this.#cpuMonitor = CPUMonitor.getInstance();
  }

  async start() {
    await this.#app.init();
    await this.#app.start();
    this.#registerShutDownSignals();

    // Only monitor CPU in main thread
    if (isMainThread) {
      this.#cpuMonitor.on("highCPU", (usage) => {
        logger.warn(
          `CPU threshold exceeded (${usage.toFixed(
            2
          )}%), initiating graceful shutdown`
        );
        this.#shutDownServer("HIGH_CPU");
      });

      this.#cpuMonitor.startMonitoring(70, 5000);
    }

    logger.info("Server started successfully");
  }

  #registerShutDownSignals() {
    process.on("SIGINT", () => this.#shutDownServer("SIGINT"));
    process.on("SIGTERM", () => this.#shutDownServer("SIGTERM"));
  }

  #shutDownServer(signal) {
    if (this.#isShuttingDown) {
      logger.warn("Shutting down the server");
      return;
    }

    this.#isShuttingDown = true;

    logger.warn(`Sever Shutting down initialiazed: ${signal}`);

    // Stop CPU monitoring during shutdown
    this.#cpuMonitor.stopMonitoring();

    const shutdownTimeout = setTimeout(() => {
      logger.error("Shutdown timeout exceeded, forcing exit");
      process.exit(1);
    }, 10000);

    Promise.resolve()
      .then(() => this.#app.stop())
      .then(() => databaseConnection.disconnect())
      .then(() => logger.close())
      .then(() => {
        clearTimeout(shutdownTimeout);
        logger.warn("Shutdown complete");
        process.exit(0);
      })
      .catch((error) => {
        clearTimeout(shutdownTimeout);
        logger.error("Error during shutdown:", error);
        process.exit(1);
      });
  }
}

const server = new Server();
server.start().catch(async (err) => {
  console.log(err);

  logger.warn("Failed to start the server", err);
  try {
    await databaseConnection.disconnect();
  } catch (error) {
    logger.error("Unable to disconnect the database");
  }
  process.exit(1);
});
