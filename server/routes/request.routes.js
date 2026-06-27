const express = require("express");
const {
  createRequest,
  getMyRequests,
  getRequestById,
  updateRequestStatus,
  respondToMatch,
  rematchRequest,
} = require("../controllers/request.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.post("/", authorize("patient"), createRequest);
router.get("/me", authorize("patient"), getMyRequests);
router.patch("/:id/status", authorize("patient"), updateRequestStatus);
router.post("/:id/rematch", authorize("patient"), rematchRequest);
router.post("/:id/respond", authorize("donor"), respondToMatch);
router.get("/:id", getRequestById);

module.exports = router;
