import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRequestById } from "../api/endpoints";

const RESPONSE_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

export default function RequestDetails() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRequestById(id)
      .then((res) => {
        setRequest(res.data.request);
        setMatches(res.data.matches);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load request"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-center py-10 text-gray-500">Loading...</p>;
  if (error) return <p className="text-center py-10 text-red-600">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/dashboard" className="text-brand text-sm font-medium hover:underline">
        &larr; Back to dashboard
      </Link>

      <div className="bg-white rounded-2xl shadow p-6 mt-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {request.bloodGroup} Request — {request.unitsNeeded} unit(s)
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-gray-600">{request.hospitalName}</p>
          {request.hospitalId?.status === "verified" ? (
            <span className="text-xs text-green-600 font-medium">
              ✓ Verified {request.hospitalId.registrationCode && `· ${request.hospitalId.registrationCode}`}
            </span>
          ) : request.hospitalId?.status === "pending" ? (
            <span className="text-xs text-yellow-600 font-medium">Pending verification</span>
          ) : null}
        </div>
        {request.description && (
          <p className="text-sm text-gray-500 mt-1">{request.description}</p>
        )}
        <div className="flex gap-4 mt-3 text-sm text-gray-500">
          <span className="capitalize">Urgency: {request.urgency}</span>
          <span className="capitalize">Status: {request.status}</span>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-3">
        Matched Donors ({matches.length})
      </h2>

      {matches.length === 0 ? (
        <p className="text-gray-500 text-sm">No donors matched yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {matches.map((m) => (
            <div key={m._id} className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">
                  {m.donorId.userId.name}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${RESPONSE_COLORS[m.donorResponse]}`}
                >
                  {m.donorResponse}
                </span>
              </div>
              <p className="text-sm text-gray-600">{m.donorId.hospitalOrBank}</p>
              <p className="text-sm text-gray-600">{m.donorId.userId.phone}</p>
              <p className="text-xs text-gray-400 mt-1">
                {m.distanceKm.toFixed(2)} km away · Blood group: {m.donorId.bloodGroup}
              </p>
              <Link
                to={`/donors/${m.donorId._id}`}
                className="inline-block mt-3 text-brand text-sm font-medium hover:underline"
              >
                View on Map &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
