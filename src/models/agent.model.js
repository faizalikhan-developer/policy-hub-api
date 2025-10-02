import mongoose from "mongoose";

const agentSchema = new mongoose.Schema(
  {
    agentName: String,
  },
  { timestamps: true }
);

agentSchema.index({ agentName: 1 }, { unique: true });

export default mongoose.model("Agent", agentSchema);
