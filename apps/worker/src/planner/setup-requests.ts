import type {
  RightsStatus,
  SourceAcquisitionState,
  SourceAcquisitionStrategy,
  SourceBlockerReason,
} from '@antenna/shared';

export type ConnectorRequestEnrichment = {
  readonly blocker_reason?: SourceBlockerReason;
  readonly acquisition_state?: SourceAcquisitionState;
  readonly acquisition_strategy?: SourceAcquisitionStrategy;
  readonly source_label?: string;
  readonly source_url?: string;
  readonly candidate_template_id?: string;
  readonly setup_hint?: string;
  readonly rights_status?: RightsStatus | 'needs-review';
};

type KnownSource = ConnectorRequestEnrichment & {
  readonly match: RegExp;
};

const KNOWN_SOURCES: readonly KnownSource[] = [
  {
    match: /tradingeconomics\.com|trading\s+economics/i,
    source_label: 'Trading Economics',
    source_url: 'https://tradingeconomics.com/',
    candidate_template_id: 'trading-economics-market',
    setup_hint:
      'Optional paid fallback; set TRADING_ECONOMICS_API_KEY and complete source-rights review.',
    rights_status: 'needs-review',
    blocker_reason: 'source_rights_blocked',
    acquisition_state: 'needs_source_review',
    acquisition_strategy: 'public_api_json',
  },
  {
    match: /artificialanalysis\.ai|artificial\s+analysis/i,
    source_label: 'Artificial Analysis',
    source_url: 'https://artificialanalysis.ai/',
    candidate_template_id: 'aa-highlights',
    setup_hint: 'Available now as Artificial Analysis highlights.',
    rights_status: 'with-attribution',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match: /tbench\.ai|terminal[-\s]?bench/i,
    source_label: 'Terminal-Bench',
    source_url: 'https://www.tbench.ai/leaderboard/terminal-bench/2.0',
    candidate_template_id: 'tbench-leaderboard',
    setup_hint: 'Available now as Terminal Bench leaderboard.',
    rights_status: 'with-attribution',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match: /finviz\.com|finviz/i,
    source_label: 'Finviz',
    source_url: 'https://finviz.com/',
    candidate_template_id: 'finviz-screener-snapshot',
    setup_hint: 'Needs an exact saved screen and export/source-rights review.',
    rights_status: 'needs-review',
    blocker_reason: 'source_rights_blocked',
    acquisition_state: 'needs_source_review',
    acquisition_strategy: 'static_html_table',
  },
  {
    match: /karpathy\.ai\/jobs|karpathy\s+jobs/i,
    source_label: 'Karpathy / BLS',
    source_url: 'https://karpathy.ai/jobs/',
    candidate_template_id: 'karpathy-jobs-snapshot',
    setup_hint: 'Available now as Karpathy jobs snapshot.',
    rights_status: 'with-attribution',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match: /github\.com\/trending|github\s+trending/i,
    source_label: 'GitHub Trending',
    source_url: 'https://github.com/trending',
    candidate_template_id: 'github-trending',
    setup_hint: 'Available now as GitHub Trending.',
    rights_status: 'with-attribution',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match:
      /github\b.*security\b.*advisories|npm\b.*(?:security|advisories|vulnerabilities|vulns?)/i,
    source_label: 'GitHub Security Advisories',
    source_url: 'https://github.com/advisories',
    candidate_template_id: 'github-security-advisories',
    setup_hint: 'Available now as npm security advisories.',
    rights_status: 'public',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match:
      /cloudflare\b.*(?:status|incidents?|outage|health|down|ok)|\bcf\b.*(?:status|incidents?|outage|health|down|ok)|workers?\s+kv\b.*(?:status|incidents?|outage|down|ok)/i,
    source_label: 'Cloudflare Status',
    source_url: 'https://www.cloudflarestatus.com/',
    candidate_template_id: 'cloudflare-incidents',
    setup_hint: 'Available now as Cloudflare incidents.',
    rights_status: 'public',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
  {
    match:
      /cisa\b.*kev|\bkev\b|known exploited vulnerabilities|security vulnerabilities being exploited/i,
    source_label: 'CISA KEV',
    source_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    candidate_template_id: 'cisa-kev-recent',
    setup_hint: 'Available now as CISA KEV additions.',
    rights_status: 'public',
    acquisition_state: 'known_connector',
    acquisition_strategy: 'first_class_connector',
  },
];

const IRRELEVANT_RX = /\b(?:how'?s it going|how is your day|hello|hi|thanks?|what'?s up)\b/i;
const AUTH_REQUIRED_RX =
  /\b(?:my|private|gmail|google calendar|my calendar|personal calendar|email|inbox|bank)\b/i;
const SYMBOL_LIKE_RX = /\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/;

export const enrichConnectorRequest = (
  fragment: string,
  prompt = fragment,
): ConnectorRequestEnrichment => {
  const haystack = `${fragment}\n${prompt}`;
  const known = KNOWN_SOURCES.find((source) => source.match.test(haystack));
  if (known) return stripMatcher(known);

  const url = firstUrl(haystack);
  if (url) {
    return {
      blocker_reason: 'unsafe_generated_extraction',
      acquisition_state: 'generated_candidate',
      acquisition_strategy: 'manual_blocker',
      source_url: url,
      setup_hint: 'Needs source review and connector design before Antenna can fetch this URL.',
    };
  }
  const blockerReason = classifyUnmatched(haystack);
  return {
    blocker_reason: blockerReason,
    acquisition_state: acquisitionStateForBlocker(blockerReason),
    acquisition_strategy: acquisitionStrategyForBlocker(blockerReason),
  };
};

const stripMatcher = ({ match: _match, ...rest }: KnownSource): ConnectorRequestEnrichment => rest;

const firstUrl = (value: string): string | undefined =>
  /https?:\/\/[^\s)]+/i.exec(value)?.[0]?.replace(/[.,]+$/, '');

const classifyUnmatched = (value: string): SourceBlockerReason => {
  if (AUTH_REQUIRED_RX.test(value)) return 'auth_required_source';
  if (SYMBOL_LIKE_RX.test(value) && /\b(?:price|chart|graph|stock|ticker|market)\b/i.test(value)) {
    return 'unsupported_symbol';
  }
  if (IRRELEVANT_RX.test(value)) return 'irrelevant_request';
  return 'unsupported_source';
};

const acquisitionStateForBlocker = (reason: SourceBlockerReason): SourceAcquisitionState => {
  if (reason === 'irrelevant_request') return 'irrelevant_match';
  if (reason === 'auth_required_source') return 'needs_credentials';
  if (reason === 'source_rights_blocked' || reason === 'unsafe_generated_extraction') {
    return 'needs_source_review';
  }
  return 'source_unavailable';
};

const acquisitionStrategyForBlocker = (reason: SourceBlockerReason): SourceAcquisitionStrategy => {
  if (reason === 'auth_required_source') return 'browser_session_setup';
  return 'manual_blocker';
};
