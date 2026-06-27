const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, minlength: 6, select: false },
    phone: { type: String, trim: true },
    googleId: { type: String, sparse: true },
    role: {
      type: String,
      enum: ["donor", "patient", "admin"],
      required: true,
    },
    isVerified: { type: Boolean, default: false },
    otp: {
      code: { type: String, select: false },
      expiresAt: { type: Date, select: false },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
