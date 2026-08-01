export type ApiErrorCode =
  | 'beacon_not_configured'
  | 'collection_quota_exceeded'
  | 'invalid_body'
  | 'invalid_collection_template'
  | 'invalid_config'
  | 'invalid_event'
  | 'invalid_json'
  | 'invalid_layout_signals'
  | 'invalid_order_signals'
  | 'invalid_query'
  | 'invalid_request'
  | 'last_collection'
  | 'manual_tokens_disabled'
  | 'mcp_get_stream_unsupported'
  | 'no_collection'
  | 'not_found'
  | 'plan_already_resolved'
  | 'rate_limited'
  | 'signal_quota_exceeded'
  | 'source_policy_blocked'
  | 'stream_unavailable'
  | 'unauthorized'
  | 'unknown_collection_template'
  | 'unknown_template';

export type ApiError = {
  readonly error: ApiErrorCode;
  readonly detail?: string;
};
