const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  getAllUsers,
  getAllDonors,
  getAllPatients,
  getAllRequests,
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
router.get("/patients", getAllPatients);
router.get("/requests", getAllRequests);

router.get("/stats", getStats);
router.patch("/donors/:id/availability", toggleDonorAvailability);
router.patch("/users/:id/role", updateUserRole);
router.patch("/users/:id/verify", toggleUserVerified);
router.post("/requests/:id/rematch", adminRematch);
router.delete("/users/:id", deleteUser);

module.exports = router;
