import axios from "axios";

// In local dev, VITE_API_URL is unset and "/api" goes through the Vite proxy
// to localhost:5000. In production, VITE_API_URL must point at the deployed
// backend's /api path since there's no proxy for a static frontend build.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
