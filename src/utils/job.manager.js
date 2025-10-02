import { Worker } from "worker_threads";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import Upload from "../models/upload.model.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class JobManager {
  static progressCache = new Map();

  static async processFile(jobId, filePath, fileName) {
    await Upload.create({
      jobId,
      fileName,
      filePath,
      status: "pending",
    });

    // Spawn worker to process file
    try {
      await this.spawnWorker(jobId, filePath);
    } catch (error) {
      logger.error(`Job ${jobId} failed:`, error.message);
      throw error;
    }
  }

  static async getJobStatus(jobId) {
    const job = await Upload.findOne({ jobId }).lean();
    if (!job) throw new Error(`Job ${jobId} not found`);
    return job;
  }

  static async updateProgress(jobId, progress) {
    const roundedPercentage = Math.floor(progress.percentage);
    const lastLogged = this.progressCache.get(jobId) || 0;

    if (roundedPercentage >= lastLogged + 10 || progress.percentage === 100) {
      await Upload.updateOne(
        { jobId },
        {
          status: "processing",
          "progress.totalRows": progress.totalRows,
          "progress.processedRows": progress.processedRows,
          "progress.percentage": progress.percentage,
        }
      );
      this.progressCache.set(jobId, roundedPercentage);
    }
  }

  static async completeJob(jobId, result) {
    await Upload.updateOne(
      { jobId },
      {
        status: "completed",
        result,
        completedAt: new Date(),
      }
    );
    this.progressCache.delete(jobId); // Cleanup
  }

  static async failJob(jobId, error) {
    await Upload.updateOne(
      { jobId },
      {
        status: "failed",
        error: {
          message: error.message,
          stack: error.stack,
        },
        failedAt: new Date(),
      }
    );
    this.progressCache.delete(jobId); // Cleanup
  }

  static async spawnWorker(jobId, filePath) {
    return new Promise((resolve, reject) => {
      const workerPath = new URL(
        "./worker/fileProcessor.worker.js",
        import.meta.url
      );

      const worker = new Worker(workerPath, {
        workerData: { jobId, filePath },
        type: "module",
      });

      let settled = false;

      worker.on("message", async (message) => {
        console.log(message);

        try {
          switch (message.type) {
            case "progress":
              await this.updateProgress(jobId, message.data);
              break;

            case "complete":
              await this.completeJob(jobId, message.data);
              settled = true;
              worker.terminate();
              resolve(message.data);
              break;

            case "error":
              await this.failJob(jobId, message.data);
              settled = true;
              worker.terminate();
              reject(new Error(message.data.message));
              break;

            default:
              logger.warn(`Unknown message type: ${message.type}`);
          }
        } catch (err) {
          console.error(`Error handling worker message:`, err);
          reject(err);
        }
      });

      worker.on("error", async (error) => {
        if (!settled) {
          await this.failJob(jobId, error);
          settled = true;
          reject(error);
        }
      });

      worker.on("exit", (code) => {
        if (!settled && code !== 0) {
          const error = new Error(`Worker stopped with exit code ${code}`);
          this.failJob(jobId, error);
          reject(error);
        }
      });
    });
  }
}
