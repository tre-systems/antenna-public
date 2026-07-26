import { positiveInt, stringValue } from './config-values';
import { fetchJson } from './fetch-json';
import type { Adapter, AdapterResult, DataPoint } from './types';
import {
  activeIncidents,
  ACTIVE_STATUSES,
  normaliseCloudflareIncidents,
  recentIncidents,
  SOURCE_PAGE,
  type NormalisedIncident,
} from './cloudflare-incidents-model';

export { activeIncidents, normaliseCloudflareIncidents, recentIncidents };

type CloudflareIncidentsConfig = {
  readonly sourceUrl?: string;
  readonly lookbackHours?: number;
  readonly limit?: number;
};

const DEFAULT_SOURCE = 'https://www.cloudflarestatus.com/api/v2/incidents.json';
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_LIMIT = 3;

export const cloudflareIncidents: Adapter<CloudflareIncidentsConfig> = async (
  config,
): Promise<AdapterResult> => {
  const sourceUrl = stringValue(config.sourceUrl) ?? DEFAULT_SOURCE;
  const fetched = await fetchJson(sourceUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'antenna' },
  });
  if (!fetched.ok) return fetched;

  const incidents = normaliseCloudflareIncidents(fetched.body);
  if (incidents.length === 0) {
    return {
      ok: false,
      error: { code: 'parse_failed', message: 'no Cloudflare incidents parsed' },
    };
  }

  const lookbackHours = positiveInt(config.lookbackHours) ?? DEFAULT_LOOKBACK_HOURS;
  const limit = positiveInt(config.limit) ?? DEFAULT_LIMIT;
  const now = Date.now();
  const active = activeIncidents(incidents);
  const recent = recentIncidents(incidents, lookbackHours, now);

  return {
    ok: true,
    points: [
      {
        dimensions: { source: 'cloudflare-status', metric: 'active_incidents' },
        value: active.length,
        unit: 'incidents',
        ts: now,
        sourceUrl: SOURCE_PAGE,
      },
      {
        dimensions: {
          source: 'cloudflare-status',
          metric: 'recent_incidents',
          hours: lookbackHours,
        },
        value: recent.length,
        unit: 'incidents',
        ts: now,
        sourceUrl: SOURCE_PAGE,
      },
      ...active
        .concat(recent.filter((incident) => !ACTIVE_STATUSES.has(incident.status)))
        .slice(0, limit)
        .map((incident, index) => toIncidentPoint(incident, index + 1, now)),
    ],
    rawPayload: { source: sourceUrl, sourcePage: SOURCE_PAGE, lookbackHours, active, recent },
  };
};

const toIncidentPoint = (incident: NormalisedIncident, rank: number, ts: number): DataPoint => ({
  dimensions: {
    source: 'cloudflare-status',
    metric: 'incident',
    rank,
    status: incident.status,
    impact: incident.impact,
    incident_id: incident.id,
    components: incident.components.slice(0, 3).join(', '),
  },
  value: incident.name,
  unit: incident.status,
  ts,
  sourceUrl: incident.sourceUrl,
});
