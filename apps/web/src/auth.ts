// A direct /api/me probe rather than Better Auth's framework client, to keep the bundle tiny.

import type { CollectionQuota, MeResponse } from '@antenna/shared';

export type User = MeResponse;

export async function getCurrentUser(): Promise<User | null> {
  // credentials: 'include' so the session cookie rides on cross-origin dev requests.
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

type UnknownFields = { readonly [K in keyof User]?: unknown };

const isUser = (value: unknown): value is User => {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as UnknownFields;
  return (
    typeof body.id === 'string' &&
    typeof body.email === 'string' &&
    typeof body.name === 'string' &&
    (body.image_url === null || typeof body.image_url === 'string') &&
    typeof body.first_seen_at === 'number' &&
    (body.onboarded_at === null || typeof body.onboarded_at === 'number') &&
    isCollectionQuota(body.collection_quota)
  );
};

const parseUser = (raw: unknown): User => {
  if (!isUser(raw)) throw new Error('User endpoint returned unexpected shape');
  // Project rather than pass through so unexpected server fields never reach the UI.
  const { id, email, name, image_url, first_seen_at, onboarded_at, collection_quota } = raw;
  return { id, email, name, image_url, first_seen_at, onboarded_at, collection_quota };
};

export async function signOut(): Promise<void> {
  // Better Auth rejects POSTs without a JSON Content-Type (415) and never clears the cookie.
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

// Time-of-day greeting in the viewer's local timezone.
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
