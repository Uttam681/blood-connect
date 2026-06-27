const User = require("../models/User");
const Donor = require("../models/Donor");
const Patient = require("../models/Patient");
const Request = require("../models/Request");
const Match = require("../models/Match");

// GET /api/admin/users
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/donors
const getAllDonors = async (req, res, next) => {
  try {
    const donors = await Donor.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: donors.length, donors });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/patients
const getAllPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: patients.length, patients });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/requests
const getAllRequests = async (req, res, next) => {
  try {
    const requests = await Request.find()
      .populate({ path: "patientId", populate: { path: "userId", select: "name email" } })
      .sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/donors/:id/availability
const toggleDonorAvailability = async (req, res, next) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });
    donor.isAvailable = !donor.isAvailable;
    await donor.save();
    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["donor", "patient", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/users/:id  — removes user + their profile + their requests/matches
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });
    }

    if (user.role === "donor") {
      const donor = await Donor.findOneAndDelete({ userId: user._id });
      if (donor) await Match.deleteMany({ donorId: donor._id });
    } else if (user.role === "patient") {
      const patient = await Patient.findOneAndDelete({ userId: user._id });
      if (patient) {
        const requests = await Request.find({ patientId: patient._id });
        const reqIds = requests.map((r) => r._id);
        await Match.deleteMany({ requestId: { $in: reqIds } });
        await Request.deleteMany({ patientId: patient._id });
      }
    }

    await user.deleteOne();
    res.json({ success: true, message: "User and all associated data deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getAllDonors,
  getAllPatients,
  getAllRequests,
  toggleDonorAvailability,
  updateUserRole,
  deleteUser,
};
