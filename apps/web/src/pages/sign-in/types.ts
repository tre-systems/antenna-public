export type SignInError = {
  // Operator refusals are non-retryable; cancellations and transient failures remain generic.
  readonly kind: 'blocked' | 'not_invited' | 'generic';
  readonly raw: string;
};

export type SocialSignInResponse = {
  readonly url?: unknown;
};
