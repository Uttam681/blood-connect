import { useEffect, useState } from "react";
import {
  getNearbyRequests,
  getMyDonorProfile,
  getMyResponses,
  respondToMatch,
  withdrawMatch,
  updateAvailability,
  updateDonorProfile,
  submitMedicalDeclaration,
} from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { geocodeAddress } from "../utils/geocode";

const URGENCY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const RESPONSE_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-gray-100 text-gray-500",
  withdrawn: "bg-orange-100 text-orange-700",
};

const MEDICAL_STATUS_COLORS = {
  unsubmitted: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
  cleared: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const MEDICAL_STATUS_LABELS = {
  unsubmitted: "Medical: Not Submitted",
  pending: "Medical: Pending Review",
  cleared: "Medically Cleared",
  rejected: "Medical: Rejected",
};

const DONATION_COOLDOWN_DAYS = 90;

const STATUS_COLORS = {
  open: "bg-yellow-100 text-yellow-700",
  matched: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const URGENCY_LEVELS = ["all", "critical", "high", "medium", "low"];
const TABS = ["Nearby Requests", "My Responses", "Edit Profile"];

export default function DonorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Nearby Requests");
  const [requests, setRequests] = useState([]);
  const [responses, setResponses] = useState([]);
  const [profile, setProfile] = useState(null);
  const [available, setAvailable] = useState(true);
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [responded, setResponded] = useState({});   // requestId → "accepted"|"declined"
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null); // matchId
  const [submittingMedical, setSubmittingMedical] = useState(false);

  const [form, setForm] = useState({
    bloodGroup: "", hospitalOrBank: "", address: "",
    city: "", state: "", pincode: "", lastDonationDate: "",
  });

  const [medicalForm, setMedicalForm] = useState({
    hemoglobin: "", weight: "", recentIllness: false, illnessDetails: "",
    medications: "", reportNotes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [reqRes, respRes, profRes] = await Promise.all([
        getNearbyRequests(25),
        getMyResponses(),
        getMyDonorProfile(),
      ]);
      setRequests(reqRes.data.requests);
      setResponses(respRes.data.responses);
      const p = profRes.data.donor;
      setProfile(p);
      setAvailable(p.isAvailable);
      setForm({
        bloodGroup: p.bloodGroup || "",
        hospitalOrBank: p.hospitalOrBank || "",
        address: p.address || "",
        city: p.city || "",
        state: p.state || "",
        pincode: p.pincode || "",
        lastDonationDate: p.lastDonationDate ? p.lastDonationDate.slice(0, 10) : "",
      });
      const d = p.medicalDeclaration || {};
      setMedicalForm({
        hemoglobin: d.hemoglobin ?? "",
        weight: d.weight ?? "",
        recentIllness: !!d.recentIllness,
        illnessDetails: d.illnessDetails || "",
        medications: d.medications || "",
        reportNotes: d.reportNotes || "",
      });
      // Pre-populate already-responded map
      const map = {};
      respRes.data.responses.forEach((r) => {
        map[r.requestId?._id] = r.donorResponse;
      });
      setResponded(map);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await updateAvailability(!available);
      setAvailable(res.data.donor.isAvailable);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update");
    } finally {
      setToggling(false);
    }
  };

  const handleRespond = async (requestId, response) => {
    setError(""); setSuccess("");
    try {
      await respondToMatch(requestId, response);
      setResponded((prev) => ({ ...prev, [requestId]: response }));
      setSuccess(`Marked as ${response}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to respond");
    }
  };

  const handleWithdraw = async (matchId, requestId) => {
    if (!window.confirm(
      "Are you sure you can't make it? This is time-sensitive for the patient — withdrawing immediately notifies them and tries to find a backup donor."
    )) return;
    setError(""); setSuccess(""); setWithdrawing(matchId);
    try {
      const res = await withdrawMatch(requestId);
      setSuccess(
        res.data.backupMatchesFound > 0
          ? `Withdrawn. ${res.data.backupMatchesFound} backup donor(s) found nearby.`
          : "Withdrawn. No backup donor found yet — the patient's request is now open again."
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to withdraw");
    } finally {
      setWithdrawing(null);
    }
  };

  const handleSubmitMedical = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmittingMedical(true);
    try {
      const res = await submitMedicalDeclaration({
        ...medicalForm,
        hemoglobin: medicalForm.hemoglobin ? Number(medicalForm.hemoglobin) : undefined,
        weight: medicalForm.weight ? Number(medicalForm.weight) : undefined,
      });
      setProfile(res.data.donor);
      setSuccess("Medical declaration submitted for review.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit medical declaration");
    } finally {
      setSubmittingMedical(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSaving(true);
    try {
      const { coordinates } = await geocodeAddress(
        [form.hospitalOrBank, form.address, form.city, form.state].filter(Boolean).join(", ")
      );
      await updateDonorProfile({ ...form, coordinates });
      setSuccess("Profile updated successfully");
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const filtered = urgencyFilter === "all"
    ? requests
    : requests.filter((r) => r.urgency === urgencyFilter);

  let cooldownUntil = null;
  if (profile?.lastDonationDate) {
    const eligibleAgain = new Date(profile.lastDonationDate);
    eligibleAgain.setDate(eligibleAgain.getDate() + DONATION_COOLDOWN_DAYS);
    if (eligibleAgain > new Date()) cooldownUntil = eligibleAgain;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h1>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-60 ${
            available ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          {available ? "Available — tap to mark unavailable" : "Unavailable — tap to mark available"}
        </button>
      </div>

      {profile && (
        <div className="flex items-center gap-2 mb-6">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${MEDICAL_STATUS_COLORS[profile.medicalStatus]}`}>
            {MEDICAL_STATUS_LABELS[profile.medicalStatus]}
          </span>
          {profile.medicalStatus === "rejected" && profile.medicalRejectionReason && (
            <span className="text-xs text-red-500">— {profile.medicalRejectionReason}</span>
          )}
        </div>
      )}

      {cooldownUntil && (
        <div className="bg-orange-50 text-orange-700 text-sm rounded-lg px-4 py-2 mb-4">
          You're inside the {DONATION_COOLDOWN_DAYS}-day post-donation cooldown window — you won't be matched to
          new requests again until {cooldownUntil.toLocaleDateString()}.
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-2 mb-4">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); setSuccess(""); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === t ? "bg-brand text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            {t === "My Responses" && responses.length > 0 && (
              <span className="ml-1.5 bg-white/30 text-xs px-1.5 py-0.5 rounded-full">
                {responses.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-500 text-sm">Loading...</p> : (
        <>
          {/* ── Nearby Requests ── */}
          {tab === "Nearby Requests" && (
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Nearby Blood Requests</h2>
                <button onClick={load} className="text-brand text-sm font-medium hover:underline">Refresh</button>
              </div>

              {/* Urgency filter */}
              <div className="flex gap-2 flex-wrap mb-4">
                {URGENCY_LEVELS.map((u) => (
                  <button
                    key={u}
                    onClick={() => setUrgencyFilter(u)}
                    className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition ${
                      urgencyFilter === u ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {u === "all" ? "All" : u}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm">No matching requests near you right now.</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((r) => {
                    const myResponse = responded[r._id];
                    return (
                      <div key={r._id} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">
                            {r.bloodGroup} · {r.unitsNeeded} unit(s)
                          </span>
                          <div className="flex gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${URGENCY_COLORS[r.urgency]}`}>
                              {r.urgency}
                            </span>
                            {myResponse && (
                              <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${RESPONSE_COLORS[myResponse]}`}>
                                You {myResponse}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600">{r.hospitalName}</p>
                          {r.hospitalRegistrationCode && (
                            <span className="text-xs text-green-600 font-medium">✓ {r.hospitalRegistrationCode}</span>
                          )}
                        </div>
                        {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
                        <p className="text-xs text-gray-400">{(r.distanceMeters / 1000).toFixed(2)} km away</p>
                        {!myResponse ? (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleRespond(r._id, "accepted")}
                              className="bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespond(r._id, "declined")}
                              className="bg-gray-200 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-300 transition"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Response already recorded</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── My Responses ── */}
          {tab === "My Responses" && (
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">My Response History</h2>
              {responses.length === 0 ? (
                <p className="text-gray-500 text-sm">You haven't responded to any requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {responses.map((m) => (
                    <div key={m._id} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">
                          {m.requestId?.bloodGroup} · {m.requestId?.unitsNeeded} unit(s)
                        </span>
                        <div className="flex gap-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${RESPONSE_COLORS[m.donorResponse]}`}>
                            {m.donorResponse}
                          </span>
                          {m.requestId?.status && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[m.requestId.status]}`}>
                              {m.requestId.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{m.requestId?.hospitalName}</p>
                      <p className="text-xs text-gray-400">
                        {m.distanceKm?.toFixed(2)} km away · Responded{" "}
                        {m.respondedAt ? new Date(m.respondedAt).toLocaleDateString() : "—"}
                      </p>
                      {m.donorResponse === "accepted" && m.requestId?.status === "matched" && (
                        <button
                          onClick={() => handleWithdraw(m._id, m.requestId._id)}
                          disabled={withdrawing === m._id}
                          className="text-orange-600 text-xs font-medium hover:underline disabled:opacity-50 text-left mt-1"
                        >
                          {withdrawing === m._id ? "Withdrawing..." : "Can't make it? Withdraw"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Edit Profile ── */}
          {tab === "Edit Profile" && (
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Edit Donor Profile</h2>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                    <select
                      value={form.bloodGroup}
                      onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital / Blood Bank</label>
                    <input
                      value={form.hospitalOrBank}
                      onChange={(e) => setForm({ ...form, hospitalOrBank: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street / area"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="City"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="State"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    placeholder="Pincode"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Donation Date</label>
                  <input
                    type="date"
                    value={form.lastDonationDate}
                    onChange={(e) => setForm({ ...form, lastDonationDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <p className="text-xs text-gray-400">Updating location re-geocodes the hospital address.</p>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-brand text-white font-medium py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </form>

              <div className="border-t border-gray-200 mt-8 pt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Medical Declaration</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Submitted for review by an admin (on behalf of your city's main verifying hospital, if one is
                  assigned). Final medical clearance always happens in person at the blood bank before donation —
                  this just flags donors who shouldn't be matched in the meantime.
                </p>
                <form onSubmit={handleSubmitMedical} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hemoglobin (g/dL)</label>
                      <input
                        type="number" step="0.1"
                        value={medicalForm.hemoglobin}
                        onChange={(e) => setMedicalForm({ ...medicalForm, hemoglobin: e.target.value })}
                        placeholder="e.g. 13.5"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        value={medicalForm.weight}
                        onChange={(e) => setMedicalForm({ ...medicalForm, weight: e.target.value })}
                        placeholder="e.g. 65"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={medicalForm.recentIllness}
                      onChange={(e) => setMedicalForm({ ...medicalForm, recentIllness: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    I've had a recent illness, surgery, or infection
                  </label>
                  {medicalForm.recentIllness && (
                    <input
                      value={medicalForm.illnessDetails}
                      onChange={(e) => setMedicalForm({ ...medicalForm, illnessDetails: e.target.value })}
                      placeholder="Briefly describe"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  )}
                  <input
                    value={medicalForm.medications}
                    onChange={(e) => setMedicalForm({ ...medicalForm, medications: e.target.value })}
                    placeholder="Current medications (if any)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <textarea
                    value={medicalForm.reportNotes}
                    onChange={(e) => setMedicalForm({ ...medicalForm, reportNotes: e.target.value })}
                    rows={3}
                    placeholder="Notes from your last checkup / blood test (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <button
                    type="submit"
                    disabled={submittingMedical}
                    className="w-full bg-gray-800 text-white font-medium py-2.5 rounded-lg hover:bg-gray-900 transition disabled:opacity-60"
                  >
                    {submittingMedical ? "Submitting..." : "Submit for Medical Review"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
