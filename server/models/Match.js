const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      required: true,
    },
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Donor",
      required: true,
    },
    distanceKm: { type: Number },
    notifiedAt: { type: Date },
    donorResponse: {
      type: String,
      enum: ["pending", "accepted", "declined", "withdrawn"],
      default: "pending",
    },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

matchSchema.index({ requestId: 1, donorId: 1 }, { unique: true });

module.exports = mongoose.model("Match", matchSchema);
