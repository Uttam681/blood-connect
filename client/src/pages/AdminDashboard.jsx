import { useEffect, useState } from "react";
import {
  adminGetUsers,
  adminGetDonors,
  adminGetRequests,
  adminGetStats,
  adminToggleDonorAvailability,
  adminUpdateUserRole,
  adminToggleVerified,
  adminRematch,
  adminDeleteUser,
} from "../api/endpoints";

const TABS = ["Users", "Donors", "Requests"];

const ROLE_COLORS = {
  donor: "bg-blue-100 text-blue-700",
  patient: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  open: "bg-yellow-100 text-yellow-700",
  matched: "bg-blue-100 text-blue-700",
  fulfilled: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-700",
};

const URGENCY_COLORS = {
  low: "bg-gray-100 text-gray-500",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

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
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rematching, setRematching] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [u, d, r, s] = await Promise.all([
        adminGetUsers(),
        adminGetDonors(),
        adminGetRequests(),
        adminGetStats(),
      ]);
      setUsers(u.data.users);
      setDonors(d.data.donors);
      setRequests(r.data.requests);
      setStats(s.data);
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
      setSuccess(`Re-match for request ${requestId.slice(-6)} — found ${res.data.newMatchesFound ?? 0} new donor(s).`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Re-match failed");
    } finally {
      setRematching(null);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-2 mb-4">{success}</div>}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Donors" value={totalDonors} />
          <StatCard label="Patients" value={totalPatients} />
          <StatCard label="Open Requests" value={openRequests} />
          <StatCard label="Fulfilled" value={fulfilledRequests} />
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
                    <th className="px-4 py-3 font-medium">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDonors.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-gray-400 text-center">No donors found</td></tr>
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
                      <td className="px-4 py-3 text-gray-600">{r.hospitalName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {r.status === "open" && (
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
        </>
      )}
    </div>
  );
}
