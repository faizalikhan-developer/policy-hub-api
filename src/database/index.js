import mongoose from "mongoose";
import { env } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class DatabaseConnection {
  static instance;
  #databaseConnection = undefined;
  #connectionPromise = null;

  static getInstance() {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }

    return DatabaseConnection.instance;
  }

  async getDatabase() {
    if (this.#connectionPromise) return this.#connectionPromise;
    if (this.#databaseConnection) return this.#databaseConnection;

    try {
      this.#connectionPromise = this.createConnection();
      this.#databaseConnection = await this.#connectionPromise;
      this.#connectionPromise = null;
      return this.#databaseConnection;
    } catch (error) {
      console.log(error);
    }
  }

  async createConnection() {
    try {
      await mongoose.connect(env.DATABASE_URL, {
        maxPoolSize: 5,
        dbName: env.DATABASE_NAME,
        serverSelectionTimeoutMS: 5000,
      });

      logger.info("Database Connection Established")

      return mongoose.connection;
    } catch (error) {
      logger.error(error);
    }
  }

  async disconnect() {
    if (this.#databaseConnection) {
      await mongoose.disconnect();
      this.#databaseConnection = null;
      this.#connectionPromise = null;
      logger.warn("database disconnected");
    }
  }
}

export const databaseConnection = DatabaseConnection.getInstance();
