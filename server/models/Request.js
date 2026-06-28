const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      required: true,
    },
    unitsNeeded: { type: Number, default: 1, min: 1 },
    urgency: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    hospitalName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
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
      enum: ["pending_verification", "open", "matched", "fulfilled", "expired", "cancelled"],
      default: "open",
    },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

requestSchema.index({ location: "2dsphere" });
requestSchema.index({ status: 1, bloodGroup: 1 });

module.exports = mongoose.model("Request", requestSchema);
