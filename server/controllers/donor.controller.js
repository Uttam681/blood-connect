const Donor = require("../models/Donor");
const Match = require("../models/Match");
const Request = require("../models/Request");

// GET /api/donors?bloodGroup=O+&lat=..&lng=..&radiusKm=10&available=true
const getDonors = async (req, res, next) => {
  try {
    const { bloodGroup, lat, lng, radiusKm = 15, available } = req.query;

    if (lat && lng) {
      const pipeline = [
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            distanceField: "distanceMeters",
            maxDistance: parseFloat(radiusKm) * 1000,
            spherical: true,
            query: {
              ...(bloodGroup && { bloodGroup }),
              ...(available !== undefined && { isAvailable: available === "true" }),
            },
          },
        },
        { $limit: 50 },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            bloodGroup: 1,
            isAvailable: 1,
            hospitalOrBank: 1,
            address: 1,
            city: 1,
            location: 1,
            distanceMeters: 1,
            "user.name": 1,
            "user.phone": 1,
          },
        },
      ];

      const donors = await Donor.aggregate(pipeline);
      return res.json({ success: true, count: donors.length, donors });
    }

    // Fallback: simple filter without geo (e.g. browse by blood group/city)
    const filter = {};
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (available !== undefined) filter.isAvailable = available === "true";

    const donors = await Donor.find(filter)
      .populate("userId", "name phone")
      .limit(50);

    res.json({ success: true, count: donors.length, donors });
  } catch (err) {
    next(err);
  }
};

// GET /api/donors/:id
const getDonorById = async (req, res, next) => {
  try {
    const donor = await Donor.findById(req.params.id).populate(
      "userId",
      "name phone email"
    );
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor not found" });
    }
    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/donors/me/availability  (donor only)
const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isAvailable must be a boolean" });
    }
    const donor = await Donor.findOneAndUpdate(
      { userId: req.user._id },
      { isAvailable },
      { new: true }
    );
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor profile not found" });
    }
    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/donors/me  (donor only)
const updateMyProfile = async (req, res, next) => {
  try {
    const { bloodGroup, hospitalOrBank, address, city, state, pincode, coordinates } =
      req.body;

    const update = {
      ...(bloodGroup && { bloodGroup }),
      ...(hospitalOrBank && { hospitalOrBank }),
      ...(address && { address }),
      ...(city && { city }),
      ...(state && { state }),
      ...(pincode && { pincode }),
      ...(coordinates && { location: { type: "Point", coordinates } }),
    };

    const donor = await Donor.findOneAndUpdate(
      { userId: req.user._id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor profile not found" });
    }
    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// GET /api/donors/requests/nearby  (donor only)
const getNearbyRequests = async (req, res, next) => {
  try {
    const { radiusKm = 15 } = req.query;
    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) {
      return res.status(404).json({ success: false, message: "Donor profile not found" });
    }

    const requests = await Request.aggregate([
      {
        $geoNear: {
          near: donor.location,
          distanceField: "distanceMeters",
          maxDistance: parseFloat(radiusKm) * 1000,
          spherical: true,
          query: { bloodGroup: donor.bloodGroup, status: { $in: ["open", "matched"] } },
        },
      },
      { $limit: 50 },
    ]);

    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    next(err);
  }
};

// GET /api/donors/me  (donor only)
const getMyProfile = async (req, res, next) => {
  try {
    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) return res.status(404).json({ success: false, message: "Donor profile not found" });
    res.json({ success: true, donor });
  } catch (err) {
    next(err);
  }
};

// GET /api/donors/me/responses  (donor only) — match history
const getMyResponses = async (req, res, next) => {
  try {
    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) return res.status(404).json({ success: false, message: "Donor profile not found" });

    const responses = await Match.find({ donorId: donor._id })
      .populate("requestId")
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: responses.length, responses });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDonors,
  getDonorById,
  getMyProfile,
  getMyResponses,
  updateAvailability,
  updateMyProfile,
  getNearbyRequests,
};
