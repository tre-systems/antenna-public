// Client-side session helper. We deliberately don't ship a copy of Better
// Auth's React/Vue client — for a one-button SPA, a direct /api/me probe
// keeps the bundle tiny and the dependency graph honest.

import type { CollectionQuota } from '@antenna/shared';

export type User = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image_url: string | null;
  readonly first_seen_at: number;
  readonly onboarded_at: number | null;
  readonly collection_quota: CollectionQuota;
};

export async function getCurrentUser(): Promise<User | null> {
  // Use credentials: 'include' so the BA session cookie rides on cross-origin
  // requests (e.g. when the SPA is served from a vite dev origin).
  const res = await fetch('/api/me', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(`GET /api/me → ${res.status} ${res.statusText}`);
  }
  return parseUser(await res.json());
}

export async function completeOnboarding(): Promise<User> {
  const res = await fetch('/api/me/onboarding', {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ completed: true }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/me/onboarding → ${res.status} ${res.statusText}`);
  }
  return parseUser(await res.json());
}

const parseUser = (raw: unknown): User => {
  const body = raw as {
    id?: unknown;
    email?: unknown;
    name?: unknown;
    image_url?: unknown;
    first_seen_at?: unknown;
    onboarded_at?: unknown;
    collection_quota?: unknown;
  };
  if (
    typeof body.id !== 'string' ||
    typeof body.email !== 'string' ||
    typeof body.name !== 'string' ||
    (body.image_url !== null && typeof body.image_url !== 'string') ||
    typeof body.first_seen_at !== 'number' ||
    (body.onboarded_at !== null && typeof body.onboarded_at !== 'number') ||
    !isCollectionQuota(body.collection_quota)
  ) {
    throw new Error('GET /api/me returned unexpected shape');
  }
  return {
    id: body.id,
    email: body.email,
    name: body.name,
    image_url: body.image_url,
    first_seen_at: body.first_seen_at,
    onboarded_at: body.onboarded_at,
    collection_quota: body.collection_quota,
  };
};

export async function signOut(): Promise<void> {
  // Better Auth rejects POSTs without a JSON Content-Type (415), so we send an
  // empty JSON body — matching completeOnboarding above. Without this the
  // session cookie is never cleared and the user stays signed in.
  const res = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`POST /api/auth/sign-out → ${res.status} ${res.statusText}`);
  }
}

export function firstName(user: Pick<User, 'email' | 'name'>): string {
  const trimmed = user.name.trim();
  if (trimmed.length === 0) return user.email;
  const space = trimmed.indexOf(' ');
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

// Time-of-day greeting in the viewer's local timezone — small touch that
// makes the header feel less like a stub and more like a place you visit.
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const isCollectionQuota = (value: unknown): value is CollectionQuota => {
  if (typeof value !== 'object' || value === null) return false;
  const quota = value as Record<string, unknown>;
  return (
    typeof quota.used === 'number' &&
    typeof quota.limit === 'number' &&
    typeof quota.remaining === 'number' &&
    typeof quota.can_create === 'boolean'
  );
};
