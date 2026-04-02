const DEFAULT_PRODUCTION_API_URL = "https://anonchat-kvm9.onrender.com";
const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

function getRuntimeDefaultApiUrl() {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return DEFAULT_LOCAL_API_URL;
  }

  return DEFAULT_PRODUCTION_API_URL;
}

export const API_URL =
  (import.meta as any)?.env?.VITE_API_URL ?? getRuntimeDefaultApiUrl();
export const SOCKET_URL = (import.meta as any)?.env?.VITE_SOCKET_URL ?? API_URL;
