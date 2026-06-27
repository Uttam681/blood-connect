const passport = require("passport");
const User = require("../models/User");
const Donor = require("../models/Donor");
const Patient = require("../models/Patient");
const generateToken = require("../utils/generateToken");

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role, donor, patient } = req.body;

    if (!name || !email || !password || !phone || !role) {
      return res.status(400).json({
        success: false,
        message: "name, email, password, phone and role are required",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const user = await User.create({ name, email, password, phone, role });

    if (role === "donor") {
      if (!donor || !donor.bloodGroup || !donor.coordinates || !donor.hospitalOrBank) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({
          success: false,
          message:
            "donor.bloodGroup, donor.coordinates [lng,lat] and donor.hospitalOrBank are required",
        });
      }
      await Donor.create({
        userId: user._id,
        bloodGroup: donor.bloodGroup,
        hospitalOrBank: donor.hospitalOrBank,
        address: donor.address,
        city: donor.city,
        state: donor.state,
        pincode: donor.pincode,
        location: { type: "Point", coordinates: donor.coordinates },
      });
    } else if (role === "patient") {
      await Patient.create({
        userId: user._id,
        age: patient?.age,
        gender: patient?.gender,
        defaultCity: patient?.defaultCity,
      });
    }

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: info?.message || "Login failed" });
    }
    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  })(req, res, next);
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/google/callback
const googleCallback = (req, res, next) => {
  passport.authenticate("google", { session: false }, (err, result) => {
    if (err || !result) {
      return res.redirect(
        `${process.env.CLIENT_ORIGIN}/login?error=google_failed`
      );
    }
    const { user, isNew } = result;
    const token = generateToken(user);
    const params = new URLSearchParams({
      token,
      name: user.name,
      role: user.role,
      isNew: isNew ? "1" : "0",
    });
    res.redirect(`${process.env.CLIENT_ORIGIN}/oauth/callback?${params}`);
  })(req, res, next);
};

module.exports = { register, login, getMe, googleCallback };
