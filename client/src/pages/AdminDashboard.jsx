import { useEffect, useState } from "react";
import {
  adminGetUsers,
  adminGetDonors,
  adminGetRequests,
  adminGetStats,
  adminGetHospitals,
  adminVerifyHospital,
  adminRejectHospital,
  adminSetCityVerifier,
  adminGetMedicalReviews,
  adminReviewDonorMedical,
  adminToggleDonorAvailability,
  adminUpdateUserRole,
  adminToggleVerified,
  adminRematch,
  adminDeleteUser,
} from "../api/endpoints";

const TABS = ["Users", "Donors", "Requests", "Hospitals", "Medical Reviews"];

const MEDICAL_STATUS_COLORS = {
  unsubmitted: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
  cleared: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const ROLE_COLORS = {
  donor: "bg-blue-100 text-blue-700",
  patient: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  pending_verification: "bg-orange-100 text-orange-700",
  open: "bg-yellow-100 text-yellow-700",
  matched: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-700",
};

const HOSPITAL_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const URGENCY_COLORS = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const formatStatus = (s) => s.replace(/_/g, " ");

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-800">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("Users");
  const [users, setUsers] = useState([]);
  const [donors, setDonors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [medicalReviews, setMedicalReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rematching, setRematching] = useState(null);
  const [verifyingHospital, setVerifyingHospital] = useState(null);
  const [reviewingDonor, setReviewingDonor] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [u, d, r, s, h, m] = await Promise.all([
        adminGetUsers(),
        adminGetDonors(),
        adminGetRequests(),
        adminGetStats(),
        adminGetHospitals(),
        adminGetMedicalReviews("pending"),
      ]);
      setUsers(u.data.users);
      setDonors(d.data.donors);
      setRequests(r.data.requests);
      setStats(s.data);
      setHospitals(h.data.hospitals);
      setMedicalReviews(m.data.donors);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleAvailability = async (donorId) => {
    try { await adminToggleDonorAvailability(donorId); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to update"); }
  };

  const handleRoleChange = async (userId, role) => {
    try { await adminUpdateUserRole(userId, role); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to update role"); }
  };

  const handleToggleVerified = async (userId) => {
    try { await adminToggleVerified(userId); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to update"); }
  };

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Delete user "${name}" and all their data? This cannot be undone.`)) return;
    try { await adminDeleteUser(userId); load(); }
    catch (err) { setError(err.response?.data?.message || "Failed to delete"); }
  };

  const handleRematch = async (requestId) => {
    setError(""); setSuccess(""); setRematching(requestId);
    try {
      const res = await adminRematch(requestId);
      setSuccess(`Re-match for request ${requestId.slice(-6)} — found ${res.data.matchesFound ?? 0} donor(s) nearby.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Re-match failed");
    } finally {
      setRematching(null);
    }
  };

  const handleVerifyHospital = async (hospitalId, name) => {
    setError(""); setSuccess(""); setVerifyingHospital(hospitalId);
    try {
      const res = await adminVerifyHospital(hospitalId);
      setSuccess(`"${name}" verified — code ${res.data.hospital.registrationCode}. ${res.data.activatedRequests} pending request(s) activated.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifyingHospital(null);
    }
  };

  const handleRejectHospital = async (hospitalId, name) => {
    const reason = window.prompt(`Reject "${name}"? Enter a reason (shown for audit purposes):`);
    if (reason === null) return;
    setError(""); setSuccess(""); setVerifyingHospital(hospitalId);
    try {
      const res = await adminRejectHospital(hospitalId, reason);
      setSuccess(`"${name}" rejected. ${res.data.cancelledRequests} pending request(s) cancelled.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Rejection failed");
    } finally {
      setVerifyingHospital(null);
    }
  };

  const handleSetCityVerifier = async (hospitalId, name) => {
    setError(""); setSuccess(""); setVerifyingHospital(hospitalId);
    try {
      const res = await adminSetCityVerifier(hospitalId);
      setSuccess(
        res.data.hospital.isCityVerifier
          ? `"${name}" is now the main medical verifier for its city.`
          : `"${name}" is no longer the city's medical verifier.`
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update");
    } finally {
      setVerifyingHospital(null);
    }
  };

  const handleReviewMedical = async (donorId, name, decision) => {
    let reason;
    if (decision === "rejected") {
      reason = window.prompt(`Reject ${name}'s medical declaration? Enter a reason:`);
      if (reason === null) return;
    }
    setError(""); setSuccess(""); setReviewingDonor(donorId);
    try {
      await adminReviewDonorMedical(donorId, decision, reason);
      setSuccess(`${name} marked as ${decision}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Review failed");
    } finally {
      setReviewingDonor(null);
    }
  };

  // Summary counts from stats
  const usersByRole = stats?.usersByRole || [];
  const requestsByStatus = stats?.requestsByStatus || [];
  const donorsByBloodGroup = stats?.donorsByBloodGroup || [];

  const totalDonors = usersByRole.find((x) => x._id === "donor")?.count ?? 0;
  const totalPatients = usersByRole.find((x) => x._id === "patient")?.count ?? 0;
  const openRequests = requestsByStatus.find((x) => x._id === "open")?.count ?? 0;
  const fulfilledRequests = requestsByStatus.find((x) => x._id === "fulfilled")?.count ?? 0;

  // Search filter
  const q = search.toLowerCase();
  const filteredUsers = users.filter(
    (u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  );
  const filteredDonors = donors.filter(
    (d) => !q || d.userId?.name?.toLowerCase().includes(q) || d.userId?.email?.toLowerCase().includes(q) || d.bloodGroup?.toLowerCase().includes(q)
  );
  const filteredRequests = requests.filter(
    (r) => !q || r.patientId?.userId?.name?.toLowerCase().includes(q) || r.hospitalName?.toLowerCase().includes(q) || r.bloodGroup?.toLowerCase().includes(q)
  );
  const filteredHospitals = hospitals.filter(
    (h) => !q || h.name?.toLowerCase().includes(q) || h.city?.toLowerCase().includes(q) || h.registrationCode?.toLowerCase().includes(q)
  );
  const pendingHospitalCount = stats?.pendingHospitals ?? 0;
  const pendingMedicalCount = stats?.pendingMedicalReviews ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-2 mb-4">{success}</div>}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-8">
          <StatCard label="Donors" value={totalDonors} />
          <StatCard label="Patients" value={totalPatients} />
          <StatCard label="Open Requests" value={openRequests} />
          <StatCard label="Fulfilled" value={fulfilledRequests} />
          <StatCard label="Pending Hospitals" value={pendingHospitalCount} sub={pendingHospitalCount > 0 ? "Needs review" : undefined} />
          <StatCard label="Pending Medical" value={pendingMedicalCount} sub={pendingMedicalCount > 0 ? "Needs review" : undefined} />
        </div>
      )}

      {/* Blood group breakdown */}
      {donorsByBloodGroup.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Donors by Blood Group</p>
          <div className="flex flex-wrap gap-2">
            {donorsByBloodGroup.map((bg) => (
              <span key={bg._id} className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1 rounded-full">
                {bg._id} · {bg.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                tab === t ? "bg-brand text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
              {t === "Medical Reviews" && medicalReviews.length > 0 && (
                <span className="ml-1.5 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {medicalReviews.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab.toLowerCase()}...`}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand w-48"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <>
          {/* Users tab */}
          {tab === "Users" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Verified</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-gray-400 text-center">No users found</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-500">{u.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-brand ${ROLE_COLORS[u.role]}`}
                        >
                          <option value="donor">donor</option>
                          <option value="patient">patient</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleVerified(u._id)}
                          className={`text-xs font-medium px-2 py-1 rounded-full transition ${
                            u.isVerified
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {u.isVerified ? "Verified" : "Unverified"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(u._id, u.name)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Donors tab */}
          {tab === "Donors" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Blood Group</th>
                    <th className="px-4 py-3 font-medium">Hospital / Bank</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Medical</th>
                    <th className="px-4 py-3 font-medium">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDonors.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-gray-400 text-center">No donors found</td></tr>
                  ) : filteredDonors.map((d) => (
                    <tr key={d._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{d.userId?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{d.userId?.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {d.bloodGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{d.hospitalOrBank}</td>
                      <td className="px-4 py-3 text-gray-500">{d.city || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${MEDICAL_STATUS_COLORS[d.medicalStatus]}`}>
                          {d.medicalStatus || "unsubmitted"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleAvailability(d._id)}
                          className={`text-xs font-medium px-3 py-1 rounded-full transition ${
                            d.isAvailable
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {d.isAvailable ? "Available" : "Unavailable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Requests tab */}
          {tab === "Requests" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Blood Group</th>
                    <th className="px-4 py-3 font-medium">Units</th>
                    <th className="px-4 py-3 font-medium">Urgency</th>
                    <th className="px-4 py-3 font-medium">Hospital</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-gray-400 text-center">No requests found</td></tr>
                  ) : filteredRequests.map((r) => (
                    <tr key={r._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {r.patientId?.userId?.name || "—"}
                        <div className="text-xs text-gray-400">{r.patientId?.userId?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                          {r.bloodGroup}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.unitsNeeded}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${URGENCY_COLORS[r.urgency]}`}>
                          {r.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.hospitalName}
                        {r.hospitalId?.status === "verified" && (
                          <div className="text-xs text-green-600">✓ {r.hospitalId.registrationCode}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                          {formatStatus(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {["open", "matched"].includes(r.status) && (
                          <button
                            onClick={() => handleRematch(r._id)}
                            disabled={rematching === r._id}
                            className="text-purple-600 text-xs font-medium hover:underline disabled:opacity-50"
                          >
                            {rematching === r._id ? "Running..." : "Re-run match"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hospitals tab */}
          {tab === "Hospitals" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Submitted By</th>
                    <th className="px-4 py-3 font-medium">Reg. Code</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHospitals.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-gray-400 text-center">No hospitals found</td></tr>
                  ) : filteredHospitals.map((h) => (
                    <tr key={h._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {h.name}
                        {h.address && <div className="text-xs text-gray-400">{h.address}</div>}
                        {h.status === "rejected" && h.rejectionReason && (
                          <div className="text-xs text-red-500 mt-0.5">Reason: {h.rejectionReason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{h.city}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {h.submittedBy?.name || "—"}
                        {h.submittedBy?.email && <div className="text-xs text-gray-400">{h.submittedBy.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{h.registrationCode || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${HOSPITAL_STATUS_COLORS[h.status]}`}>
                          {h.status}
                        </span>
                        {h.isCityVerifier && (
                          <div className="text-xs text-purple-600 font-medium mt-0.5">★ City medical verifier</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {h.status === "pending" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVerifyHospital(h._id, h.name)}
                              disabled={verifyingHospital === h._id}
                              className="text-green-600 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              {verifyingHospital === h._id ? "Working..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleRejectHospital(h._id, h.name)}
                              disabled={verifyingHospital === h._id}
                              className="text-red-500 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : h.status === "verified" ? (
                          <button
                            onClick={() => handleSetCityVerifier(h._id, h.name)}
                            disabled={verifyingHospital === h._id}
                            className="text-purple-600 text-xs font-medium hover:underline disabled:opacity-50"
                          >
                            {h.isCityVerifier ? "Unset city verifier" : "Set as city verifier"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {h.verifiedBy?.name ? `by ${h.verifiedBy.name}` : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Medical Reviews tab */}
          {tab === "Medical Reviews" && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Donor</th>
                    <th className="px-4 py-3 font-medium">Declaration</th>
                    <th className="px-4 py-3 font-medium">City Verifier</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {medicalReviews.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-gray-400 text-center">No pending medical reviews</td></tr>
                  ) : medicalReviews.map((d) => {
                    const decl = d.medicalDeclaration || {};
                    return (
                      <tr key={d._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {d.userId?.name || "—"}
                          <div className="text-xs text-gray-400">{d.userId?.email} · {d.bloodGroup}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                          {decl.hemoglobin && <div>Hb: {decl.hemoglobin} g/dL</div>}
                          {decl.weight && <div>Weight: {decl.weight} kg</div>}
                          {decl.recentIllness && (
                            <div className="text-orange-600">Recent illness: {decl.illnessDetails || "yes"}</div>
                          )}
                          {decl.medications && <div>Meds: {decl.medications}</div>}
                          {decl.reportNotes && <div className="text-gray-400 italic mt-0.5">"{decl.reportNotes}"</div>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {d.medicalReviewHospitalId?.name || (
                            <span className="text-gray-400">No city verifier assigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${MEDICAL_STATUS_COLORS[d.medicalStatus]}`}>
                            {d.medicalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReviewMedical(d._id, d.userId?.name || "Donor", "cleared")}
                              disabled={reviewingDonor === d._id}
                              className="text-green-600 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              Clear
                            </button>
                            <button
                              onClick={() => handleReviewMedical(d._id, d.userId?.name || "Donor", "rejected")}
                              disabled={reviewingDonor === d._id}
                              className="text-red-500 text-xs font-medium hover:underline disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
