export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(await errorMessage(path, init, res));
  return (await res.json()) as T;
}

const errorMessage = async (
  path: string,
  init: RequestInit | undefined,
  res: Response,
): Promise<string> => {
  const body = await res.text().catch(() => '');
  const detail = body ? `: ${body.slice(0, 200)}` : '';
  return `${init?.method ?? 'GET'} ${path} → ${res.status} ${res.statusText}${detail}`;
};
