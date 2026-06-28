const Hospital = require("../models/Hospital");

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/hospitals?search=&city=  — verified hospitals only (patient picker)
const searchHospitals = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = { status: "verified" };
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: "i" } },
        { city: { $regex: safe, $options: "i" } },
      ];
    }
    const hospitals = await Hospital.find(filter).sort({ name: 1 }).limit(20);
    res.json({ success: true, count: hospitals.length, hospitals });
  } catch (err) {
    next(err);
  }
};

// POST /api/hospitals  (patient only) — submit a new hospital for admin verification
const submitHospital = async (req, res, next) => {
  try {
    const { name, address, city, state, pincode, contactPhone, coordinates } = req.body;

    if (!name || !city || !coordinates) {
      return res.status(400).json({
        success: false,
        message: "name, city and coordinates [lng, lat] are required",
      });
    }

    const hospital = await Hospital.create({
      name,
      address,
      city,
      state,
      pincode,
      contactPhone,
      location: { type: "Point", coordinates },
      submittedBy: req.user._id,
      status: "pending",
    });

    res.status(201).json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

module.exports = { searchHospitals, submitHospital };
