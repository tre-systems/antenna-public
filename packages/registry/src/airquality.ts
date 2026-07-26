import { airQualityOpenMeteo } from '@antenna/connectors';
import { z } from 'zod';
import { extractLocation } from './location-extract';
import { type ConnectorTemplate } from './types';

type AirTemplateConfig = { lat?: number; lon?: number; location?: string };

// Same caveat as the weather template: lat/lon must be resolved upstream.
export const airQualityTemplate: ConnectorTemplate<AirTemplateConfig> = {
  id: 'airquality',
  displayName: 'Air quality',
  configSchema: z.object({
    lat: z.number(),
    lon: z.number(),
    location: z.string().optional(),
  }),
  paramKeys: ['location', 'lat', 'lon'] as const,
  matchHints: [
    /\bair\s+quality\b/i,
    /\baqi\b/i,
    /\bpollution\b/i,
    /\bsmog\b/i,
    /\bpm2\.5\b/i,
    /\bpm10\b/i,
  ],
  paramExtractors: {
    location: extractLocation,
    lat: () => undefined,
    lon: () => undefined,
  },
  rightsStatus: 'public',
  defaultRefreshSeconds: 1800,
  pointRetentionDays: 30,
  adapter: async (config) => {
    if (typeof config.lat !== 'number' || typeof config.lon !== 'number') {
      return {
        ok: false,
        error: { code: 'parse_failed', message: 'airquality requires resolved lat/lon' },
      };
    }
    return airQualityOpenMeteo({ lat: config.lat, lon: config.lon, location: config.location });
  },
};
