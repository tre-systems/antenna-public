export type SignInError = {
  readonly kind: 'whitelist' | 'generic';
  readonly raw: string;
};

export type SocialSignInResponse = {
  readonly url?: unknown;
};
