import { useEffect, useState } from "react";
import {
  adminGetUsers,
  adminGetDonors,
  adminGetRequests,
  adminToggleDonorAvailability,
  adminUpdateUserRole,
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

export default function AdminDashboard() {
  const [tab, setTab] = useState("Users");
  const [users, setUsers] = useState([]);
  const [donors, setDonors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [u, d, r] = await Promise.all([
        adminGetUsers(),
        adminGetDonors(),
        adminGetRequests(),
      ]);
      setUsers(u.data.users);
      setDonors(d.data.donors);
      setRequests(r.data.requests);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleAvailability = async (donorId) => {
    try {
      await adminToggleDonorAvailability(donorId);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update");
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await adminUpdateUserRole(userId, role);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleDelete = async (userId, name) => {
    if (!window.confirm(`Delete user "${name}" and all their data? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(userId);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">
        {users.length} users · {donors.length} donors · {requests.length} requests
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
              tab === t
                ? "bg-brand text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
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
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
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
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
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
                  {donors.map((d) => (
                    <tr key={d._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {d.userId?.name || "—"}
                      </td>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((r) => (
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
                      <td className="px-4 py-3 capitalize text-gray-600">{r.urgency}</td>
                      <td className="px-4 py-3 text-gray-600">{r.hospitalName}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString()}
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
