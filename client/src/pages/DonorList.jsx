import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDonors } from "../api/endpoints";
import MapView from "../components/MapView";
import { geocodeAddress } from "../utils/geocode";

const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export default function DonorList() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState("list"); // "list" | "map"
  const [center, setCenter] = useState(null);

  const [filters, setFilters] = useState({
    bloodGroup: "",
    location: "",
    radiusKm: 25,
    available: true,
  });

  const search = async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await getDonors(params);
      setDonors(res.data.donors);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load donors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search({ available: true });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");
    const params = { available: filters.available };
    if (filters.bloodGroup) params.bloodGroup = filters.bloodGroup;

    if (filters.location) {
      try {
        const { coordinates: [lng, lat] } = await geocodeAddress(filters.location);
        params.lat = lat;
        params.lng = lng;
        params.radiusKm = filters.radiusKm;
        setCenter([lat, lng]);
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    search(params);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        search({
          bloodGroup: filters.bloodGroup || undefined,
          available: filters.available,
          lat: latitude,
          lng: longitude,
          radiusKm: filters.radiusKm,
        });
      },
      () => setError("Unable to get your location")
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Find Donors</h1>

      <form
        onSubmit={handleSearch}
        className="bg-white rounded-2xl shadow p-4 mb-6 grid sm:grid-cols-5 gap-3 items-end"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blood Group
          </label>
          <select
            value={filters.bloodGroup}
            onChange={(e) => setFilters({ ...filters, bloodGroup: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>
                {bg || "Any"}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            placeholder="City / area"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Radius (km)
          </label>
          <input
            type="number"
            min="1"
            value={filters.radiusKm}
            onChange={(e) => setFilters({ ...filters, radiusKm: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-brand text-white font-medium py-2.5 rounded-lg hover:bg-brand-dark transition"
          >
            Search
          </button>
        </div>
        <div className="sm:col-span-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="text-brand text-sm font-medium hover:underline"
          >
            Use my current location
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1 rounded-md text-sm font-medium ${view === "list" ? "bg-white shadow text-brand" : "text-gray-500"}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className={`px-3 py-1 rounded-md text-sm font-medium ${view === "map" ? "bg-white shadow text-brand" : "text-gray-500"}`}
            >
              Map
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading donors...</p>
      ) : view === "map" ? (
        <MapView donors={donors} center={center} zoom={center ? 11 : undefined} />
      ) : donors.length === 0 ? (
        <p className="text-gray-500 text-sm">No donors found.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {donors.map((donor) => (
            <div key={donor._id} className="bg-white rounded-2xl shadow p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">
                  {donor.user?.name || donor.userId?.name}
                </span>
                <span className="bg-brand text-white text-xs font-bold px-2 py-1 rounded-full">
                  {donor.bloodGroup}
                </span>
              </div>
              <p className="text-sm text-gray-600">{donor.hospitalOrBank}</p>
              {donor.city && <p className="text-sm text-gray-500">{donor.city}</p>}
              {donor.distanceMeters !== undefined && (
                <p className="text-xs text-gray-400 mt-1">
                  {(donor.distanceMeters / 1000).toFixed(2)} km away
                </p>
              )}
              <p className="text-xs mt-2">
                <span
                  className={`font-medium ${donor.isAvailable ? "text-green-600" : "text-gray-400"}`}
                >
                  {donor.isAvailable ? "Available" : "Not available"}
                </span>
              </p>
              <Link
                to={`/donors/${donor._id}`}
                className="inline-block mt-3 text-brand text-sm font-medium hover:underline"
              >
                View details &rarr;
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
