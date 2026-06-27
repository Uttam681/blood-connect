const Request = require("../models/Request");
const Patient = require("../models/Patient");
const Donor = require("../models/Donor");
const Match = require("../models/Match");
const { findAndRecordMatches } = require("../services/matching.service");

// POST /api/requests  (patient only)
const createRequest = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient profile not found" });
    }

    const {
      bloodGroup,
      unitsNeeded,
      urgency,
      hospitalName,
      description,
      coordinates, // [lng, lat]
      radiusKm,
      expiresAt,
    } = req.body;

    if (!bloodGroup || !hospitalName || !coordinates) {
      return res.status(400).json({
        success: false,
        message: "bloodGroup, hospitalName and coordinates [lng, lat] are required",
      });
    }

    const request = await Request.create({
      patientId: patient._id,
      bloodGroup,
      unitsNeeded,
      urgency,
      hospitalName,
      description,
      location: { type: "Point", coordinates },
      expiresAt,
    });

    const matches = await findAndRecordMatches(request, radiusKm);
    if (matches.length > 0) {
      request.status = "matched";
      await request.save();
    }

    res.status(201).json({ success: true, request, matchesFound: matches.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/requests/me  (patient only)
const getMyRequests = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient profile not found" });
    }
    const requests = await Request.find({ patientId: patient._id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// GET /api/requests/:id
const getRequestById = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const matches = await Match.find({ requestId: request._id }).populate({
      path: "donorId",
      populate: { path: "userId", select: "name phone" },
    });

    res.json({ success: true, request, matches });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/requests/:id/status  (patient only - own request)
const updateRequestStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["fulfilled", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(", ")}`,
      });
    }

    const patient = await Patient.findOne({ userId: req.user._id });
    const request = await Request.findOneAndUpdate(
      { _id: req.params.id, patientId: patient._id },
      { status },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// POST /api/requests/:id/respond  (donor only)
const respondToMatch = async (req, res, next) => {
  try {
    const { response } = req.body; // "accepted" | "declined"
    if (!["accepted", "declined"].includes(response)) {
      return res.status(400).json({
        success: false,
        message: "response must be 'accepted' or 'declined'",
      });
    }

    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor profile not found" });
    }

    const match = await Match.findOneAndUpdate(
      { requestId: req.params.id, donorId: donor._id },
      { donorResponse: response, respondedAt: new Date() },
      { new: true }
    );

    if (!match) {
      return res.status(404).json({ success: false, message: "Match not found" });
    }

    res.json({ success: true, match });
  } catch (err) {
    next(err);
  }
};

// POST /api/requests/:id/rematch  (patient only — re-run matching on an open request)
const rematchRequest = async (req, res, next) => {
  try {
    const patient = await Patient.findOne({ userId: req.user._id });
    const request = await Request.findOne({ _id: req.params.id, patientId: patient?._id });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    if (request.status !== "open") {
      return res.status(400).json({ success: false, message: "Only open requests can be re-matched" });
    }
    const { radiusKm } = req.body;
    const matches = await findAndRecordMatches(request, radiusKm);
    if (matches.length > 0) {
      request.status = "matched";
      await request.save();
    }
    res.json({ success: true, matchesFound: matches.length, request });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getRequestById,
  updateRequestStatus,
  respondToMatch,
  rematchRequest,
};
