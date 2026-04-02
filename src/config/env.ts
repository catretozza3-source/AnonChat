export const API_URL = (import.meta as any)?.env?.VITE_API_URL ?? "http://localhost:3001";
export const SOCKET_URL = (import.meta as any)?.env?.VITE_SOCKET_URL ?? API_URL;
