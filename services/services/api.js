import axios from "axios";

const API = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

// Add auth token from localStorage to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem("sb_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("sb_access_token");
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(err);
  }
);

export function formatApiError(detail) {
  if (!detail) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default API;
