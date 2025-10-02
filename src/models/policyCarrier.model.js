import mongoose from "mongoose";

const policyCarrierSchema = new mongoose.Schema(
  {
    companyName: String
  },
  { timestamps: true }
);

policyCarrierSchema.index({ companyName: 1 }, { unique: true });


export default mongoose.model("PolicyCarrier", policyCarrierSchema);
