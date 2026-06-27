const express = require("express");
const passport = require("passport");
const { register, login, getMe, googleCallback } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// Google OAuth — initiate + callback
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);
router.get("/google/callback", googleCallback);

module.exports = router;
