const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
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
} = require("../controllers/admin.controller");

const router = express.Router();

// All admin routes require JWT + admin role
router.use(protect, authorize("admin"));

router.get("/users", getAllUsers);
router.get("/donors", getAllDonors);
router.get("/donors/medical-reviews", getMedicalReviews);
router.get("/patients", getAllPatients);
router.get("/requests", getAllRequests);
router.get("/hospitals", getAllHospitals);

router.get("/stats", getStats);
router.patch("/donors/:id/availability", toggleDonorAvailability);
router.patch("/donors/:id/medical-review", reviewDonorMedical);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/verify", toggleUserVerified);
router.patch("/hospitals/:id/verify", verifyHospital);
router.patch("/hospitals/:id/reject", rejectHospital);
router.patch("/hospitals/:id/city-verifier", setCityVerifier);
router.post("/requests/:id/rematch", adminRematch);
router.delete("/users/:id", deleteUser);

module.exports = router;
