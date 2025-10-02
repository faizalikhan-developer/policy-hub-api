import os from "os";
import { EventEmitter } from "events";
import { logger } from "./logger.js";

export class CPUMonitor extends EventEmitter {
  static instance;
  #previousCPUInfo = null;
  #lastAlertTime = null;
  #cooldownMs = 30000;
  #intervalId = null;

  static getInstance() {
    if (!CPUMonitor.instance) {
      CPUMonitor.instance = new CPUMonitor();
    }

    return CPUMonitor.instance;
  }

  getCPUTimes() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    });

    return { idle, total };
  }

  getCurrentUsage() {
    const current = this.getCPUTimes();

    if (!this.#previousCPUInfo) {
      this.#previousCPUInfo = current;
      return 0;
    }

    const idleDiff = current.idle - this.#previousCPUInfo.idle;
    const totalDiff = current.total - this.#previousCPUInfo.total;
    const usage = 100 - (100 * idleDiff) / totalDiff;

    this.#previousCPUInfo = current;

    return usage;
  }

  startMonitoring(threshold = 70, interval = 5000) {
    if (this.#intervalId) {
      logger.warn("CPU monitoring already started");
      return;
    }

    logger.info(
      `Starting CPU monitoring (threshold: ${threshold}%, interval: ${interval}ms)`
    );

    this.#intervalId = setInterval(() => {
      const usage = this.getCurrentUsage();

      if (usage > threshold) {
        const now = Date.now();

        if (
          this.#lastAlertTime &&
          now - this.#lastAlertTime < this.#cooldownMs
        ) {
          return;
        }

        this.#lastAlertTime = now;
        logger.warn(`High CPU usage detected: ${usage.toFixed(2)}%`);
        this.emit("highCPU", usage);
      }
    }, interval);
  }

  stopMonitoring() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      logger.info("CPU monitoring stopped");
    }
  }
}