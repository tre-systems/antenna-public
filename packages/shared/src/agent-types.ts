export type McpTokenRecord = {
  readonly id: string;
  readonly label: string | null;
  readonly created_at: number;
  readonly last_used_at: number | null;
  readonly revoked_at: number | null;
};

export type McpOAuthConnectionRecord = {
  readonly client_id: string;
  readonly name: string;
  readonly created_at: number;
  readonly last_refreshed_at: number;
  readonly access_expires_at: number;
  readonly refresh_expires_at: number;
  readonly scopes: ReadonlyArray<string>;
};
