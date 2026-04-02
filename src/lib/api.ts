import { API_URL } from "@/config/env";

export async function apiRequest<T>(
  path: string,
  method: string,
  body?: unknown,
  token?: string
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Errore del server.");
  }

  return data as T;
}
