import express from "express";
import { env } from "./config/environment.js";
import { databaseConnection } from "./database/index.js";
import morgan from "morgan";
import { errorHandler } from "./middlewares/error.handler.js";
import { logger } from "./utils/logger.js";
import routes from "./routes/index.js";
import Agent from "./models/agent.model.js";
import User from "./models/user.model.js";
import PolicyCarrier from "./models/policyCarrier.model.js";
import PolicyCategory from "./models/policyCategory.model.js";
import Account from "./models/userAccount.model.js";
import PolicyInfo from "./models/policyInfo.model.js";

export class App {
  #_database;
  server = null;

  constructor() {
    this.app = express();
    this.PORT = env.PORT;
    this.API_VERSION = env.API_VERSION;
  }

  get database() {
    if (!this.#_database) throw new Error("Database not initialized");
    return this.#_database;
  }

  async init() {
    this.#_database = await databaseConnection.getDatabase();

    this.#initializeMiddleware();
    this.#initializeRoutes();
    await this.#initializeCollections();
  }

  async #initializeCollections() {
    await Agent.init();
    await User.init();
    await PolicyCarrier.init();
    await PolicyCategory.init();
    await Account.init();
    await PolicyInfo.init();
  }

  #initializeMiddleware() {
    this.app.use(morgan("combined"));
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  #initializeRoutes() {
    this.app.get("/health", (req, res) => {
      if (this.#_database.readyState !== 1) {
        return res.status(503).json({
          status: "Service Unavailable",
          version: this.API_VERSION,
          database: "disconnected",
        });
      }

      res.status(200).json({
        status: "OK",
        version: this.API_VERSION,
      });
    });

    // main api
    this.app.use("/api", routes);

    // 404 route
    this.app.use((req, res) => {
      res.status(404).json({
        status: 404,
        message: `Requested Route ${req.originalUrl} not found`,
      });
    });

    // error handler
    this.app.use(errorHandler);
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.PORT, (err) => {
        if (err) reject(err);
        else {
          logger.info(`Application is running on PORT: ${this.PORT}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    if (!this.server) return;

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject();
        else {
          logger.warn("server closed");
          resolve();
        }
      });
    });
  }
}
