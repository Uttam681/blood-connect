import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createRequest,
  getMyPatientProfile,
  updatePatientProfile,
  getMyRequests,
  updateRequestStatus,
  rematchRequest,
} from "../api/endpoints";
import { geocodeAddress } from "../utils/geocode";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const URGENCY_LEVELS = ["low", "medium", "high", "critical"];
const STATUS_FILTERS = ["all", "open", "matched", "fulfilled", "cancelled"];

const STATUS_COLORS = {
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
    hospitalName: "",
    description: "",
    radiusKm: 15,
  });

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      const query =
        defaultCity && !form.hospitalName.toLowerCase().includes(defaultCity.toLowerCase())
          ? `${form.hospitalName}, ${defaultCity}`
          : form.hospitalName;

      const { coordinates, displayName } = await geocodeAddress(query);
      const proceed = window.confirm(
        `Resolved location:\n${displayName}\n\nUse this location for your request?`
      );
      if (!proceed) { setSubmitting(false); return; }

      const res = await createRequest({
        bloodGroup: form.bloodGroup,
        unitsNeeded: Number(form.unitsNeeded),
        urgency: form.urgency,
        hospitalName: form.hospitalName,
        description: form.description,
        coordinates,
        radiusKm: Number(form.radiusKm),
      });
      setSuccess(`Request created! Found ${res.data.matchesFound} matching donor(s) nearby.`);
      setForm({ ...form, hospitalName: "", description: "" });
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
      setSuccess(`Re-match complete — found ${res.data.newMatchesFound ?? 0} new donor(s).`);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name / Location</label>
              <input
                name="hospitalName" required value={form.hospitalName} onChange={handleChange}
                placeholder="e.g. Apollo Hospital, Hyderabad"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-gray-400 mt-1">Used to locate nearby donors automatically.</p>
            </div>

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
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No {statusFilter === "all" ? "" : statusFilter + " "}requests.</p>
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
                        {r.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{r.hospitalName}</p>
                  <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Link to={`/requests/${r._id}`} className="text-brand text-sm font-medium hover:underline">
                      View matches
                    </Link>
                    {r.status === "open" && (
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
