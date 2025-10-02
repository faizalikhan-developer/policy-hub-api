import mongoose from "mongoose";

const uploadSchema = new mongoose.Schema({
  jobId: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "done", "failed"],
    default: "pending",
    required: true,
  },
  progress: {
    totalRows: {
      type: Number,
      default: 0,
    },
    processedRows: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
  },
  result: {
    users: {
      type: Number,
      default: 0,
    },
    policies: {
      type: Number,
      default: 0,
    },
    agents: {
      type: Number,
      default: 0,
    },
    accounts: {
      type: Number,
      default: 0,
    },
    carriers: {
      type: Number,
      default: 0,
    },
    lobs: {
      type: Number,
      default: 0,
    },
  },
  error: [
    {
      row: {
        type: Number,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    suppressReservedKeysWarning: true,
  },
});

export default mongoose.model("Upload", uploadSchema);
