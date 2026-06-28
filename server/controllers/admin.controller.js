const crypto = require("crypto");
const User = require("../models/User");
const Donor = require("../models/Donor");
const Patient = require("../models/Patient");
const Request = require("../models/Request");
const Match = require("../models/Match");
const Hospital = require("../models/Hospital");
const { findAndRecordMatches } = require("../services/matching.service");

const generateRegistrationCode = () => `BH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

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
      .populate("hospitalId", "name status registrationCode")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/hospitals
const getAllHospitals = async (req, res, next) => {
  try {
    const hospitals = await Hospital.find()
      .populate("submittedBy", "name email")
      .populate("verifiedBy", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, count: hospitals.length, hospitals });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/hospitals/:id/verify
const verifyHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    hospital.status = "verified";
    if (!hospital.registrationCode) hospital.registrationCode = generateRegistrationCode();
    hospital.verifiedBy = req.user._id;
    hospital.verifiedAt = new Date();
    hospital.rejectionReason = undefined;
    await hospital.save();

    // Activate any requests that were waiting on this hospital's verification
    const pendingRequests = await Request.find({
      hospitalId: hospital._id,
      status: "pending_verification",
    });

    for (const request of pendingRequests) {
      request.status = "open";
      const matches = await findAndRecordMatches(request);
      if (matches.length > 0) request.status = "matched";
      await request.save();
    }

    res.json({ success: true, hospital, activatedRequests: pendingRequests.length });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/hospitals/:id/reject
const rejectHospital = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    hospital.status = "rejected";
    hospital.rejectionReason = reason || "Failed verification";
    hospital.verifiedBy = req.user._id;
    hospital.verifiedAt = new Date();
    await hospital.save();

    // Cancel any requests waiting on this hospital
    const cancelled = await Request.updateMany(
      { hospitalId: hospital._id, status: "pending_verification" },
      { status: "cancelled" }
    );

    res.json({ success: true, hospital, cancelledRequests: cancelled.modifiedCount });
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

// PATCH /api/admin/users/:id/verify
const toggleUserVerified = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    user.isVerified = !user.isVerified;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/requests/:id/rematch
const adminRematch = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    if (!["open", "matched"].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Only open or matched requests can be re-matched" });
    }
    const hasConfirmedDonor = await Match.exists({ requestId: request._id, donorResponse: "accepted" });
    if (hasConfirmedDonor) {
      return res.status(400).json({
        success: false,
        message: "This request already has a confirmed donor — no need to re-match",
      });
    }
    const matches = await findAndRecordMatches(request, 30);
    if (matches.length > 0) {
      request.status = "matched";
      await request.save();
    }
    res.json({ success: true, matchesFound: matches.length, request });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/hospitals/:id/city-verifier — designate the one main
// verifying hospital for that city (unsets the flag on any sibling hospital
// in the same city so there's always at most one per city)
const setCityVerifier = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });
    if (hospital.status !== "verified") {
      return res.status(400).json({
        success: false,
        message: "Only a verified hospital can be set as the city's medical verifier",
      });
    }

    const makingVerifier = !hospital.isCityVerifier;

    if (makingVerifier) {
      await Hospital.updateMany(
        { city: hospital.city, _id: { $ne: hospital._id } },
        { isCityVerifier: false }
      );
    }
    hospital.isCityVerifier = makingVerifier;
    await hospital.save();

    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/donors/medical-reviews?status=pending
const getMedicalReviews = async (req, res, next) => {
  try {
    const { status = "pending" } = req.query;
    const filter = status === "all" ? {} : { medicalStatus: status };
    const donors = await Donor.find(filter)
      .populate("userId", "name email phone")
      .populate("medicalReviewHospitalId", "name city registrationCode")
      .populate("medicalVerifiedBy", "name email")
      .sort({ "medicalDeclaration.submittedAt": -1 });
    res.json({ success: true, count: donors.length, donors });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/donors/:id/medical-review  body: { decision: "cleared"|"rejected", reason }
const reviewDonorMedical = async (req, res, next) => {
  try {
    const { decision, reason } = req.body;
    if (!["cleared", "rejected"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be 'cleared' or 'rejected'" });
    }

    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });

    donor.medicalStatus = decision;
    donor.medicalVerifiedBy = req.user._id;
    donor.medicalVerifiedAt = new Date();
    donor.medicalRejectionReason = decision === "rejected" ? reason || "Did not meet eligibility criteria" : undefined;
    await donor.save();

    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [usersByRole, requestsByStatus, donorsByBloodGroup, pendingHospitals, pendingMedicalReviews] =
      await Promise.all([
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        Request.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Donor.aggregate([{ $group: { _id: "$bloodGroup", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
        Hospital.countDocuments({ status: "pending" }),
        Donor.countDocuments({ medicalStatus: "pending" }),
      ]);
    res.json({
      success: true,
      usersByRole,
      requestsByStatus,
      donorsByBloodGroup,
      pendingHospitals,
      pendingMedicalReviews,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getAllDonors,
  getAllPatients,
  getAllRequests,
  getAllHospitals,
  verifyHospital,
  rejectHospital,
  setCityVerifier,
  getMedicalReviews,
  reviewDonorMedical,
  toggleDonorAvailability,
  toggleUserVerified,
  updateUserRole,
  deleteUser,
  adminRematch,
  getStats,
};
