import Message from "../models/message.model.js";
import { agenda } from "../utils/agenda.js";
import { BadRequest, NotFoundError } from "../utils/app.error.js";
import { JobManager } from "../utils/job.manager.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import User from '../models/user.model.js'
import PolicyInfo from '../models/policyInfo.model.js'

export class Controller {
  static async uploadFile(req, res, next) {
    const jobId = uuidv4();
    const filePath = req.file.path;
    const fileName = req.file.originalname;

    if (!filePath || !fileName) {
      throw new BadRequest("File is required");
    }

    try {
      JobManager.processFile(jobId, filePath, fileName);

      res.json({
        success: true,
        jobId,
        message: "File upload started",
      });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }

  static async getJobStatus(req, res, next) {
    const { jobId } = req.params;
    if (!jobId) throw new BadRequest("jobId is required");

    const job = await JobManager.getJobStatus(jobId);
    if (!job) throw new NotFoundError("Job not found");

    console.log(job);

    res.status(200).json({
      jobId: job.jobId,
      status: job.status,
      processedRows: job.progress?.processedRows || 0,
    });
  }

  static async searchPolicy(req, res, next) {
    try {
      const { username } = req.query;

      if (!username)
        throw new BadRequest("username query parameter is required");

      const user = await User.findOne({
        $or: [{ firstName: username }, { email: username }],
      });

      if (!user) throw new NotFoundError("User not found");

      const policies = await PolicyInfo.find({ userId: user._id })
        .populate("policyCategoryId", "categoryName")
        .populate("companyId", "companyName");

      res.json({
        success: true,
        user: { id: user._id, name: user.firstName, email: user.email },
        policies,
      });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }

  static async getPolicies(req, res, next) {
    try {
      const result = await PolicyInfo.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $group: {
            _id: "$user._id",
            userName: { $first: "$user.firstName" },
            email: { $first: "$user.email" },
            totalPolicies: { $sum: 1 },
            policies: {
              $push: {
                policyNumber: "$policyNumber",
                startDate: "$policyStartDate",
                endDate: "$policyEndDate",
              },
            },
          },
        },
      ]);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }

  static async scheduleMessage(req, res, next) {
    try {
      const { message, day, time } = req.body;
      if (!message || !day || !time) {
        throw new BadRequest("message, day, and time are required");
      }

      const scheduleDate = new Date(`${day} ${time}`);
      if (isNaN(scheduleDate)) {
        throw new BadRequest("Invalid day/time format");
      }

      const msg = await Message.create({
        message,
        scheduledAt: scheduleDate,
        createdAt: new Date(),
      });

      await agenda.schedule(scheduleDate, "send message", {
        messageId: msg._id,
      });

      res.json({
        success: true,
        message: "Message scheduled",
        data: msg,
      });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }
}
