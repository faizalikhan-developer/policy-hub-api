import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    accountName: String,
    userId: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

accountSchema.index({ accountName: 1, userId: 1 }, { unique: true });
accountSchema.index({ userId: 1 });

export default mongoose.model("Account", accountSchema);
