import { parentPort, workerData } from "worker_threads";
import { env } from "../../config/environment.js";
import { logger } from "../logger.js";
import User from "../../models/user.model.js";
import Agent from "../../models/agent.model.js";
import Account from "../../models/userAccount.model.js";
import PolicyCarrier from "../../models/policyCarrier.model.js";
import PolicyCategory from "../../models/policyCategory.model.js";
import PolicyInfo from "../../models/policyInfo.model.js";

import mongoose from "mongoose";
import XLSX from "xlsx";

class FileProcessorWorker {
  constructor(jobId, filePath) {
    this.jobId = jobId;
    this.filePath = filePath;
  }

  async saveToDB(processedData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (processedData.agents.length)
        await Agent.bulkWrite(
          processedData.agents.map((a) => ({
            updateOne: {
              filter: { agentName: a.agentName },
              update: { $setOnInsert: a },
              upsert: true,
            },
          })),
          { session }
        );

      const agents = await Agent.find({
        agentName: { $in: processedData.agents.map((a) => a.agentName) },
      }).session(session);

      if (processedData.users.length) {
        await User.bulkWrite(
          processedData.users.map((u) => ({
            updateOne: {
              filter: { email: u.email },
              update: { $setOnInsert: u },
              upsert: true,
            },
          })),
          { session }
        );
      }
      const users = await User.find({
        email: { $in: processedData.users.map((u) => u.email) },
      }).session(session);
      const userIdMap = new Map(users.map((u) => [u.email, u._id]));

      if (processedData.carriers.length) {
        await PolicyCarrier.bulkWrite(
          processedData.carriers.map((c) => ({
            updateOne: {
              filter: { companyName: c.companyName },
              update: { $setOnInsert: c },
              upsert: true,
            },
          })),
          { session }
        );
      }
      const carriers = await PolicyCarrier.find({
        companyName: { $in: processedData.carriers.map((c) => c.companyName) },
      }).session(session);
      const carrierIdMap = new Map(carriers.map((c) => [c.companyName, c._id]));

      // Categories (unique on categoryName)
      if (processedData.categories.length) {
        await PolicyCategory.bulkWrite(
          processedData.categories.map((cat) => ({
            updateOne: {
              filter: { categoryName: cat.categoryName },
              update: { $setOnInsert: cat },
              upsert: true,
            },
          })),
          { session }
        );
      }
      const categories = await PolicyCategory.find({
        categoryName: {
          $in: processedData.categories.map((c) => c.categoryName),
        },
      }).session(session);
      const categoryIdMap = new Map(
        categories.map((c) => [c.categoryName, c._id])
      );

      const accountsWithUserId = processedData.accounts.map((acc) => ({
        accountName: acc.accountName,
        userId: userIdMap.get(acc.userEmail),
      }));

      if (accountsWithUserId.length) {
        await Account.bulkWrite(
          accountsWithUserId.map((acc) => ({
            updateOne: {
              filter: { accountName: acc.accountName, userId: acc.userId },
              update: { $setOnInsert: acc },
              upsert: true,
            },
          })),
          { session }
        );
      }
      const accounts = await Account.find({
        userId: { $in: [...userIdMap.values()] },
      }).session(session);

      // ---------- Step 3: Policies depend on user, carrier, category ----------
      const policiesWithRefs = processedData.policies.map((p) => ({
        policyNumber: p.policyNumber,
        policyStartDate: p.policyStartDate,
        policyEndDate: p.policyEndDate,
        policyCategoryId: categoryIdMap.get(p.categoryName),
        companyId: carrierIdMap.get(p.companyName),
        userId: userIdMap.get(p.userEmail),
      }));

      if (policiesWithRefs.length) {
        await PolicyInfo.bulkWrite(
          policiesWithRefs.map((p) => ({
            updateOne: {
              filter: { policyNumber: p.policyNumber, companyId: p.companyId },
              update: { $setOnInsert: p },
              upsert: true,
            },
          })),
          { session }
        );
      }

      await session.commitTransaction();

      return {
        success: true,
        counts: {
          agents: agents.length,
          users: users.length,
          accounts: accounts.length,
          carriers: carriers.length,
          categories: categories.length,
          policies: policiesWithRefs.length,
        },
      };
    } catch (error) {
      console.log(error);

      if (session.inTransaction) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      session.endSession();
    }
  }

  async processRows(rows) {
    const agentsMap = new Map();
    const usersMap = new Map();
    const accountsMap = new Map();
    const carriersMap = new Map();
    const categoriesMap = new Map();
    const policiesArray = [];

    for (let row of rows) {
      // Agent
      if (!agentsMap.has(row.agent)) {
        agentsMap.set(row.agent, { agentName: row.agent });
      }

      if (!usersMap.has(row.email)) {
        usersMap.set(row.email, {
          firstName: row.firstname,
          dob: this.excelDateToJSDate(row.dob),
          address: row.address,
          phone: row.phone?.toString(),
          state: row.state,
          zipCode: row.zip?.toString(),
          email: row.email,
          gender: row.gender || null,
          userType: row.userType,
        });
      }

      // Account (dedupe by accountName)
      if (!accountsMap.has(row.account_name)) {
        accountsMap.set(row.account_name, {
          accountName: row.account_name,
          userEmail: row.email, // Temp field for lookup later
        });
      }

      // Carrier
      if (!carriersMap.has(row.company_name)) {
        carriersMap.set(row.company_name, { companyName: row.company_name });
      }

      // Category
      if (!categoriesMap.has(row.category_name)) {
        categoriesMap.set(row.category_name, {
          categoryName: row.category_name,
        });
      }

      policiesArray.push({
        policyNumber: row.policy_number,
        policyStartDate: this.excelDateToJSDate(row.policy_start_date),
        policyEndDate: this.excelDateToJSDate(row.policy_end_date),
        // temp lookup fields
        categoryName: row.category_name,
        companyName: row.company_name,
        userEmail: row.email,
      });
    }

    return {
      agents: Array.from(agentsMap.values()),
      users: Array.from(usersMap.values()),
      accounts: Array.from(accountsMap.values()),
      carriers: Array.from(carriersMap.values()),
      categories: Array.from(categoriesMap.values()),
      policies: policiesArray,
    };
  }

  async processExcel(filePath) {
    const workbook = XLSX.readFile(filePath, { sheetRows: 0 }); // Get metadata only
    const sheetName = workbook.SheetNames[0];

    // For large files, use streaming or read in chunks
    // But for this assignment, your current approach is acceptable
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
  }

  excelDateToJSDate(serial) {
    let utc_days = Math.floor(serial - 25569);
    let utc_value = utc_days * 86400;
    let date_info = new Date(utc_value * 1000);

    let fractional_day = serial - Math.floor(serial) + 0.0000001;

    let total_seconds = Math.floor(86400 * fractional_day);

    let seconds = total_seconds % 60;

    total_seconds -= seconds;

    let hours = Math.floor(total_seconds / (60 * 60));
    let minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(
      date_info.getFullYear(),
      date_info.getMonth(),
      date_info.getDate(),
      hours,
      minutes,
      seconds
    );
  }

  async processFile() {
    try {
      // connect with database
      await mongoose.connect(env.DATABASE_URL, { dbName: env.DATABASE_NAME });

      logger.info("File Processor Worker is connected to database");

      // process in batches
      const rows = await this.processExcel(this.filePath);
      const batchSize = 1000;
      let processedRows = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const processed = await this.processRows(batch);
        const result = await this.saveToDB(processed);

        processedRows += batch.length;

        // Send progress
        parentPort.postMessage({
          type: "progress",
          data: {
            totalRows: rows.length,
            processedRows,
            percentage: (processedRows / rows.length) * 100,
          },
        });
      }

      return {
        success: true,
        totalRows: rows.length,
        processedRows,
      };
    } catch (error) {
      logger.error(`Worker error: ${error.message}`);
      throw error;
    } finally {
      await mongoose.connection.close();
    }
  }
}

(async () => {
  try {
    const { jobId, filePath } = workerData;

    const fileProcessorWorker = new FileProcessorWorker(jobId, filePath);
    const result = await fileProcessorWorker.processFile();

    // Send completion message
    parentPort.postMessage({
      type: "complete",
      data: result,
    });

    process.exit(0);
  } catch (error) {
    console.log(error);

    logger.error(`Worker fatal error: ${error.message}`);

    parentPort.postMessage({
      type: "error",
      data: { message: error.message, stack: error.stack },
    });

    process.exit(1);
  }
})();
