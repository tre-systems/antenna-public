export type SignInError = {
  // Two refusals are not worth retrying: a blocked account, and an address the
  // operator has not invited when this deployment runs a closed allowlist.
  // Everything else — a cancelled Google consent, a transient failure — is
  // generic and retryable.
  readonly kind: 'blocked' | 'not_invited' | 'generic';
  readonly raw: string;
};

export type SocialSignInResponse = {
  readonly url?: unknown;
};
