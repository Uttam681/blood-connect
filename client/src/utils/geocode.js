// Free geocoding via OpenStreetMap Nominatim — converts an address string to
// [lng, lat] plus the resolved display name (so the caller can confirm the
// match and avoid ambiguous results, e.g. "Apollo Hospital" without a city).
export async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Geocoding request failed");
  const data = await res.json();
  if (!data.length) throw new Error("Location not found. Try a more specific address.");
  return {
    coordinates: [parseFloat(data[0].lon), parseFloat(data[0].lat)],
    displayName: data[0].display_name,
  };
}
