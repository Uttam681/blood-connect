const mongoose = require("mongoose");

const donorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
      required: true,
    },
    isAvailable: { type: Boolean, default: true },
    lastDonationDate: { type: Date },
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
    hospitalOrBank: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },

    medicalStatus: {
      type: String,
      enum: ["unsubmitted", "pending", "cleared", "rejected"],
      default: "unsubmitted",
    },
    medicalDeclaration: {
      hemoglobin: Number,
      weight: Number,
      recentIllness: { type: Boolean, default: false },
      illnessDetails: { type: String, trim: true },
      medications: { type: String, trim: true },
      reportNotes: { type: String, trim: true },
      submittedAt: Date,
    },
    medicalReviewHospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    medicalVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    medicalVerifiedAt: Date,
    medicalRejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

donorSchema.index({ location: "2dsphere" });
donorSchema.index({ bloodGroup: 1, isAvailable: 1 });

module.exports = mongoose.model("Donor", donorSchema);
