import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: process.env.PORT || 4009,
  DATABASE_URL: process.env.DATABASE_URL || "",
  DATABASE_NAME: process.env.DATABASE_NAME || "",
  NODE_ENV: process.env.NODE_ENV || "dev",
  API_VERSION: process.env.API_VERSION || "v1",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  REDIS_HOST: process.env.REDIS_HOST || "",
  REDIS_PORT: process.env.REDIS_PORT || 1,
};
