import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { completeOnboarding, firstName, getCurrentUser, greetingFor, signOut } from './auth';

type FetchArgs = Parameters<typeof fetch>;
const quota = { used: 2, limit: 10, remaining: 8, can_create: true };
const apiUser = {
  id: 'u1',
  email: 'a@b.com',
  name: 'Alex Reid',
  image_url: null,
  first_seen_at: 1000,
  onboarded_at: null,
  collection_quota: quota,
};

const mockFetch = (impl: (...args: FetchArgs) => Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null on 401', async () => {
    mockFetch(() => Promise.resolve(new Response(null, { status: 401 })));
    expect(await getCurrentUser()).toBeNull();
  });

  it('returns the user on 200', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify(apiUser), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const u = await getCurrentUser();
    expect(u).toEqual(apiUser);
  });

  it('throws on a non-401 error', async () => {
    mockFetch(() =>
      Promise.resolve(new Response('boom', { status: 500, statusText: 'Server Error' })),
    );
    await expect(getCurrentUser()).rejects.toThrow(/500/);
  });

  it('throws on a malformed response body', async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'x' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(getCurrentUser()).rejects.toThrow(/shape/);
  });

  it('rejects null without leaking a property-access failure', async () => {
    mockFetch(() => Promise.resolve(Response.json(null)));
    await expect(getCurrentUser()).rejects.toThrow('User endpoint returned unexpected shape');
  });
});

describe('firstName', () => {
  it('extracts the first whitespace-separated word', () => {
    expect(firstName({ email: 'a@b.com', name: 'Alex Reid' })).toBe('Alex');
    expect(firstName({ email: 'a@b.com', name: 'Alex' })).toBe('Alex');
  });
  it('falls back to email when name is blank', () => {
    expect(firstName({ email: 'a@b.com', name: '   ' })).toBe('a@b.com');
  });
});

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks onboarding complete and returns the updated user', async () => {
    const updated = { ...apiUser, onboarded_at: 2000 };
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(updated), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await expect(completeOnboarding()).resolves.toEqual(updated);
    expect(fetchSpy).toHaveBeenCalledWith('/api/me/onboarding', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ completed: true }),
    });
  });

  it('throws when onboarding completion fails', async () => {
    mockFetch(() =>
      Promise.resolve(new Response('boom', { status: 500, statusText: 'Server Error' })),
    );

    await expect(completeOnboarding()).rejects.toThrow(/500/);
  });
});

describe('greetingFor', () => {
  it('picks a copy per time of day', () => {
    expect(greetingFor(new Date('2026-05-20T02:00:00'))).toBe('Up late');
    expect(greetingFor(new Date('2026-05-20T08:00:00'))).toBe('Good morning');
    expect(greetingFor(new Date('2026-05-20T14:00:00'))).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-05-20T20:00:00'))).toBe('Good evening');
  });
});

describe('signOut', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the Better Auth sign-out endpoint', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await signOut();

    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  });

  it('throws when sign-out fails', async () => {
    mockFetch(() =>
      Promise.resolve(new Response('boom', { status: 500, statusText: 'Server Error' })),
    );

    await expect(signOut()).rejects.toThrow(/500/);
  });
});
