const express = require("express");
const { protect, authorize } = require("../middleware/auth");
const {
  getAllUsers,
  getAllDonors,
  getAllPatients,
  getAllRequests,
  toggleDonorAvailability,
  updateUserRole,
  deleteUser,
} = require("../controllers/admin.controller");

const router = express.Router();

// All admin routes require JWT + admin role
router.use(protect, authorize("admin"));

router.get("/users", getAllUsers);
router.get("/donors", getAllDonors);
router.get("/patients", getAllPatients);
router.get("/requests", getAllRequests);

router.patch("/donors/:id/availability", toggleDonorAvailability);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

module.exports = router;
