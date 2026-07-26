import { vi } from 'vitest';

type FetchArgs = Parameters<typeof fetch>;

export type CapturedCall = { url: string; init?: RequestInit };

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const urlOf = (input: FetchArgs[0]): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

// Stubs fetch to always answer with `body`, and returns the array the calls land in.
export const captureFetch = (body: unknown): CapturedCall[] => {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: FetchArgs[0], init?: RequestInit) => {
      calls.push({ url: urlOf(input), init });
      return Promise.resolve(jsonResponse(body));
    }),
  );
  return calls;
};
