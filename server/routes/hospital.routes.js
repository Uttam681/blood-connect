const express = require("express");
const { searchHospitals, submitHospital } = require("../controllers/hospital.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/", searchHospitals);
router.post("/", authorize("patient"), submitHospital);

module.exports = router;
