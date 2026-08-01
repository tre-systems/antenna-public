// These patterns guard identifiers interpolated into Analytics Engine SQL.
export const ACCOUNT_ID_RX = /^[0-9a-f]{32}$/;
export const SLUG_RX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const analyticsSqlUrl = (accountId: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
