const express = require("express");
const {
  getDonors,
  getDonorById,
  getMyProfile,
  getMyResponses,
  updateAvailability,
  updateMyProfile,
  getNearbyRequests,
} = require("../controllers/donor.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", getDonors);

// Donor-only routes (must be before /:id to avoid route collision)
router.get("/me", protect, authorize("donor"), getMyProfile);
router.get("/me/responses", protect, authorize("donor"), getMyResponses);
router.patch("/me/availability", protect, authorize("donor"), updateAvailability);
router.patch("/me", protect, authorize("donor"), updateMyProfile);
router.get("/requests/nearby", protect, authorize("donor"), getNearbyRequests);

router.get("/:id", getDonorById);

module.exports = router;
