// utils/agenda.js
import Agenda from "agenda";
import mongoose from "mongoose";
import { logger } from "./logger.js";

const agenda = new Agenda({
  mongo: mongoose.connection, // reuse existing Mongoose connection
  db: { collection: "jobs" }, // jobs stored in this collection
  processEvery: "30 seconds", // check interval
});

// Define a job for sending messages
agenda.define("send message", async (job) => {
  const { messageId } = job.attrs.data;

  const Message = (await import("../models/message.model.js")).default;
  const msg = await Message.findById(messageId);

  if (!msg) {
    logger.warn(`Message with ID ${messageId} not found`);
    return;
  }

  try {
    // Replace this with actual sending logic (email, notification, etc.)
    logger.info(`Delivering scheduled message: ${msg.message}`);

    msg.status = "sent";
    msg.sentAt = new Date();
    await msg.save();
  } catch (err) {
    logger.error(`Failed to deliver message ${messageId}:`, err);
    msg.status = "failed";
    await msg.save();
  }
});

// Start Agenda
(async function () {
  await agenda.start();
  logger.info("Agenda scheduler started");
})();

export { agenda };
