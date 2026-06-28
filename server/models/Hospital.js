const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    registrationCode: { type: String, unique: true, sparse: true },
    address: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    isCityVerifier: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hospitalSchema.index({ location: "2dsphere" });
hospitalSchema.index({ name: "text", city: "text" });

module.exports = mongoose.model("Hospital", hospitalSchema);
