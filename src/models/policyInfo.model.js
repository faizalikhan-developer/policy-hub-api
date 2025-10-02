import mongoose from "mongoose";

const policyInfoSchema = new mongoose.Schema(
  {
    policyNumber: String,
    policyStartDate: Date,
    policyEndDate: Date,
    policyCategoryId: mongoose.Schema.Types.ObjectId,
    companyId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

policyInfoSchema.index({ policyNumber: 1 }, { unique: true });
policyInfoSchema.index({ userId: 1 });
policyInfoSchema.index({ companyId: 1 });
policyInfoSchema.index({ policyCategoryId: 1 });

export default mongoose.model("PolicyInfo", policyInfoSchema);
