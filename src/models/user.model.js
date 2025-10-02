import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    dob: Date,
    address: String,
    phone: String,
    state: String,
    zipCode: String,
    email: String,
    gender: String,
    userType: String,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
