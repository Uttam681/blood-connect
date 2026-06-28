const Donor = require("../models/Donor");
const Match = require("../models/Match");

const DEFAULT_RADIUS_KM = 15;
const MAX_MATCHES = 20;
const DONATION_COOLDOWN_DAYS = 90;

// Finds available, eligible donors with the requested blood group near the
// request location, then records them in the matches collection. Donors are
// excluded if they're inside the post-donation cooldown window or have been
// medically rejected by an admin/hospital review.
const findAndRecordMatches = async (request, radiusKm = DEFAULT_RADIUS_KM) => {
  const cooldownCutoff = new Date(Date.now() - DONATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const donors = await Donor.aggregate([
    {
      $geoNear: {
        near: request.location,
        distanceField: "distanceMeters",
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: {
          bloodGroup: request.bloodGroup,
          isAvailable: true,
          medicalStatus: { $ne: "rejected" },
          $or: [
            { lastDonationDate: { $exists: false } },
            { lastDonationDate: null },
            { lastDonationDate: { $lte: cooldownCutoff } },
          ],
        },
      },
    },
    { $limit: MAX_MATCHES },
  ]);

  const matches = await Promise.all(
    donors.map((donor) =>
      Match.findOneAndUpdate(
        { requestId: request._id, donorId: donor._id },
        {
          requestId: request._id,
          donorId: donor._id,
          distanceKm: donor.distanceMeters / 1000,
          notifiedAt: new Date(),
        },
        { upsert: true, new: true }
      )
    )
  );

  return matches;
};

module.exports = { findAndRecordMatches };
