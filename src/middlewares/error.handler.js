import { AppError } from "../utils/app.error.js";
import { logger } from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      err,
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
      },
    },
    "Request Error"
  );

  const payload = {
    message: err.message || "Internal Server Error",
    status: 500,
  };

  if (err instanceof AppError) {
    const { message, statusCode } = err;

    payload.message = message;
    payload.status = statusCode;
  } else if (err instanceof SyntaxError && "body" in err) {
    payload.message = "Invalid Json Format";
    payload.status = 400;
  }

  res.status(payload.status).json(payload);
};
