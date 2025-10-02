import mongoose from "mongoose";

const policyCategorySchema = new mongoose.Schema(
  {
    categoryName: String,
  },
  { timestamps: true }
);

policyCategorySchema.index({ categoryName: 1 }, { unique: true });

export default mongoose.model("PolicyCategory", policyCategorySchema);
