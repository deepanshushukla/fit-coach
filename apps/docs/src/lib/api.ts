const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

/**
 * This site only ever calls public, unauthenticated GET endpoints (/v1/exercises,
 * /v1/plans), so it needs none of the portal's token/refresh machinery — just fetch+json.
 */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return (await res.json()) as T;
}
