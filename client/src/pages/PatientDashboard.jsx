import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createRequest,
  getMyPatientProfile,
  updatePatientProfile,
  getMyRequests,
  updateRequestStatus,
  rematchRequest,
  searchHospitals,
  submitHospital,
} from "../api/endpoints";
import { geocodeAddress } from "../utils/geocode";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const URGENCY_LEVELS = ["low", "medium", "high", "critical"];
const STATUS_FILTERS = ["all", "pending_verification", "open", "matched", "fulfilled", "cancelled"];

const STATUS_COLORS = {
  pending_verification: "bg-orange-100 text-orange-700",
  open: "bg-yellow-100 text-yellow-700",
  matched: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-700",
};

const URGENCY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const formatStatus = (s) => s.replace(/_/g, " ");

export default function PatientDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [defaultCity, setDefaultCity] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [rematching, setRematching] = useState(null); // requestId
  const [profile, setProfile] = useState({ age: "", gender: "", defaultCity: "" });

  const [form, setForm] = useState({
    bloodGroup: "O+",
    unitsNeeded: 1,
    urgency: "medium",
    description: "",
    radiusKm: 15,
  });

  // Hospital picker state
  const [hospitalQuery, setHospitalQuery] = useState("");
  const [hospitalResults, setHospitalResults] = useState([]);
  const [searchingHospitals, setSearchingHospitals] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [showNewHospitalForm, setShowNewHospitalForm] = useState(false);
  const [submittingHospital, setSubmittingHospital] = useState(false);
  const [newHospital, setNewHospital] = useState({
    name: "", address: "", city: "", state: "", pincode: "", contactPhone: "",
  });
  const searchDebounce = useRef(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await getMyRequests();
      setRequests(res.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = () =>
    getMyPatientProfile()
      .then((res) => {
        const p = res.data.patient || {};
        setDefaultCity(p.defaultCity || "");
        setProfile({
          age: p.age || "",
          gender: p.gender || "",
          defaultCity: p.defaultCity || "",
        });
      })
      .catch(() => {});

  useEffect(() => {
    loadRequests();
    loadProfile();
  }, []);

  // Debounced hospital search as the patient types
  useEffect(() => {
    if (selectedHospital) return; // don't re-search once a hospital is picked
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!hospitalQuery.trim()) { setHospitalResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchingHospitals(true);
      try {
        const res = await searchHospitals(hospitalQuery.trim());
        setHospitalResults(res.data.hospitals);
      } catch {
        setHospitalResults([]);
      } finally {
        setSearchingHospitals(false);
      }
    }, 350);
    return () => clearTimeout(searchDebounce.current);
  }, [hospitalQuery, selectedHospital]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSelectHospital = (hospital) => {
    setSelectedHospital(hospital);
    setHospitalQuery("");
    setHospitalResults([]);
    setShowNewHospitalForm(false);
  };

  const handleClearHospital = () => {
    setSelectedHospital(null);
    setHospitalQuery("");
  };

  const handleOpenNewHospitalForm = () => {
    setShowNewHospitalForm(true);
    setNewHospital({ ...newHospital, city: newHospital.city || defaultCity });
  };

  const handleSubmitNewHospital = async (e) => {
    e.preventDefault();
    setError(""); setSubmittingHospital(true);
    try {
      const addressQuery = [newHospital.name, newHospital.address, newHospital.city, newHospital.state]
        .filter(Boolean)
        .join(", ");
      const { coordinates, displayName } = await geocodeAddress(addressQuery);
      const proceed = window.confirm(
        `Resolved location:\n${displayName}\n\nSubmit this hospital for admin verification?`
      );
      if (!proceed) { setSubmittingHospital(false); return; }

      const res = await submitHospital({ ...newHospital, coordinates });
      handleSelectHospital(res.data.hospital);
      setShowNewHospitalForm(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to submit hospital");
    } finally {
      setSubmittingHospital(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!selectedHospital) {
      setError("Please select or submit a hospital/blood bank for this request.");
      return;
    }

    if (selectedHospital.status !== "verified") {
      const proceed = window.confirm(
        `"${selectedHospital.name}" is still pending admin verification. Your request will be created but won't be visible to donors until it's verified. Continue?`
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const res = await createRequest({
        bloodGroup: form.bloodGroup,
        unitsNeeded: Number(form.unitsNeeded),
        urgency: form.urgency,
        hospitalId: selectedHospital._id,
        description: form.description,
        radiusKm: Number(form.radiusKm),
      });
      setSuccess(
        res.data.hospitalStatus === "verified"
          ? `Request created! Found ${res.data.matchesFound} matching donor(s) nearby.`
          : "Request created — it will go live once the hospital is verified by an admin."
      );
      setForm({ ...form, description: "" });
      handleClearHospital();
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try { await updateRequestStatus(id, "cancelled"); loadRequests(); }
    catch (err) { setError(err.response?.data?.message || "Failed to cancel request"); }
  };

  const handleFulfilled = async (id) => {
    try { await updateRequestStatus(id, "fulfilled"); loadRequests(); }
    catch (err) { setError(err.response?.data?.message || "Failed to update request"); }
  };

  const handleRematch = async (id) => {
    setError(""); setSuccess(""); setRematching(id);
    try {
      const res = await rematchRequest(id, 30);
      setSuccess(`Re-match complete — found ${res.data.matchesFound ?? 0} donor(s) nearby.`);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || "Re-match failed");
    } finally {
      setRematching(null);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setProfileSaving(true);
    try {
      await updatePatientProfile(profile);
      setDefaultCity(profile.defaultCity);
      setSuccess("Profile updated.");
      setEditOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const filtered = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Patient Dashboard</h1>
        <button
          onClick={() => setEditOpen(!editOpen)}
          className="text-sm font-medium text-brand hover:underline"
        >
          {editOpen ? "Close profile" : "Edit profile"}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-2 mb-4">{success}</div>}

      {/* Edit Profile */}
      {editOpen && (
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Edit Profile</h2>
          <form onSubmit={handleProfileSave} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
              <input
                type="number"
                min="1"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Default City</label>
              <input
                value={profile.defaultCity}
                onChange={(e) => setProfile({ ...profile, defaultCity: e.target.value })}
                placeholder="e.g. Hyderabad"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
            >
              {profileSaving ? "Saving..." : "Save"}
            </button>
          </form>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Create request form */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Raise a Blood Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select
                  name="bloodGroup"
                  value={form.bloodGroup}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Units Needed</label>
                <input
                  type="number" name="unitsNeeded" min="1"
                  value={form.unitsNeeded} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <select
                name="urgency" value={form.urgency} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {URGENCY_LEVELS.map((u) => <option key={u} value={u} className="capitalize">{u}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital / Blood Bank</label>

              {selectedHospital ? (
                <div className="flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 bg-gray-50">
                  <div>
                    <span className="font-medium text-gray-800">{selectedHospital.name}</span>
                    {selectedHospital.city && (
                      <span className="text-gray-500 text-sm"> · {selectedHospital.city}</span>
                    )}
                    <div className="mt-0.5">
                      {selectedHospital.status === "verified" ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Verified {selectedHospital.registrationCode && `· ${selectedHospital.registrationCode}`}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                          Pending admin verification
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearHospital}
                    className="text-gray-400 hover:text-gray-600 text-sm font-medium"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={hospitalQuery}
                    onChange={(e) => setHospitalQuery(e.target.value)}
                    placeholder="Search verified hospitals by name or city..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  {searchingHospitals && (
                    <p className="text-xs text-gray-400 mt-1">Searching...</p>
                  )}
                  {hospitalResults.length > 0 && (
                    <div className="border border-gray-200 rounded-lg mt-1 divide-y divide-gray-100 max-h-44 overflow-y-auto">
                      {hospitalResults.map((h) => (
                        <button
                          key={h._id}
                          type="button"
                          onClick={() => handleSelectHospital(h)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                        >
                          <span>{h.name} <span className="text-gray-400">· {h.city}</span></span>
                          <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {hospitalQuery && !searchingHospitals && hospitalResults.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">No verified hospital found.</p>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenNewHospitalForm}
                    className="text-brand text-xs font-medium hover:underline mt-1"
                  >
                    Can't find your hospital? Submit it for verification
                  </button>
                </>
              )}

              <p className="text-xs text-gray-400 mt-1">
                Requests are tied to a verified hospital to prevent fraudulent or
                trafficking-related blood requests.
              </p>
            </div>

            {showNewHospitalForm && !selectedHospital && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-medium text-gray-700">Submit a new hospital / blood bank</p>
                <input
                  required
                  value={newHospital.name}
                  onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })}
                  placeholder="Hospital / blood bank name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <input
                  value={newHospital.address}
                  onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })}
                  placeholder="Street / area"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    required
                    value={newHospital.city}
                    onChange={(e) => setNewHospital({ ...newHospital, city: e.target.value })}
                    placeholder="City"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    value={newHospital.state}
                    onChange={(e) => setNewHospital({ ...newHospital, state: e.target.value })}
                    placeholder="State"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <input
                    value={newHospital.pincode}
                    onChange={(e) => setNewHospital({ ...newHospital, pincode: e.target.value })}
                    placeholder="Pincode"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <input
                  value={newHospital.contactPhone}
                  onChange={(e) => setNewHospital({ ...newHospital, contactPhone: e.target.value })}
                  placeholder="Hospital contact phone (optional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitNewHospital}
                    disabled={submittingHospital}
                    className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
                  >
                    {submittingHospital ? "Submitting..." : "Submit for verification"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewHospitalForm(false)}
                    className="text-gray-500 text-sm font-medium px-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description" value={form.description} onChange={handleChange}
                rows={3} placeholder="Reason / additional details"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Radius (km)</label>
              <input
                type="number" name="radiusKm" min="1" value={form.radiusKm} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full bg-brand text-white font-medium py-2.5 rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Raise Request"}
            </button>
          </form>
        </div>

        {/* My requests */}
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">My Requests</h2>
            <span className="text-xs text-gray-400">{requests.length} total</span>
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition ${
                  statusFilter === s ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {formatStatus(s)}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No {statusFilter === "all" ? "" : formatStatus(statusFilter) + " "}requests.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div key={r._id} className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">
                      {r.bloodGroup} · {r.unitsNeeded} unit(s)
                    </span>
                    <div className="flex gap-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${URGENCY_COLORS[r.urgency]}`}>
                        {r.urgency}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                        {formatStatus(r.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600">{r.hospitalName}</p>
                    {r.hospitalId?.status === "verified" ? (
                      <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                    ) : r.hospitalId?.status === "pending" ? (
                      <span className="text-xs text-yellow-600 font-medium">Pending verification</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Link to={`/requests/${r._id}`} className="text-brand text-sm font-medium hover:underline">
                      View matches
                    </Link>
                    {["open", "matched"].includes(r.status) && (
                      <button
                        onClick={() => handleRematch(r._id)}
                        disabled={rematching === r._id}
                        className="text-purple-600 text-sm font-medium hover:underline disabled:opacity-50"
                      >
                        {rematching === r._id ? "Re-matching..." : "Re-match"}
                      </button>
                    )}
                    {r.status !== "fulfilled" && r.status !== "cancelled" && (
                      <>
                        <button
                          onClick={() => handleFulfilled(r._id)}
                          className="text-green-600 text-sm font-medium hover:underline"
                        >
                          Mark fulfilled
                        </button>
                        <button
                          onClick={() => handleCancel(r._id)}
                          className="text-gray-500 text-sm font-medium hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
