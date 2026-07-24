import { weatherOpenMeteo } from '@antenna/connectors';
import { z } from 'zod';
import { extractLocation } from './location-extract';
import { type ConnectorTemplate } from './types';

type WeatherTemplateConfig = { lat?: number; lon?: number; location?: string };

// Geocoding is a separate concern; until the planner resolves lat/lon we fail
// loudly here so the caller surfaces the missing params back to the user.
export const weatherTemplate: ConnectorTemplate<WeatherTemplateConfig> = {
  id: 'weather',
  displayName: 'Weather',
  configSchema: z.object({
    lat: z.number(),
    lon: z.number(),
    location: z.string().optional(),
  }),
  paramKeys: ['location', 'lat', 'lon'] as const,
  matchHints: [
    /\bweather\b/i,
    /\btemperature\b/i,
    /\btemp\s+in\b/i,
    /\bhot\b/i,
    /\bcold\b/i,
    /\bhumidity\b/i,
  ],
  paramExtractors: {
    location: extractLocation,
    lat: () => undefined,
    lon: () => undefined,
  },
  rightsStatus: 'with-attribution',
  defaultRefreshSeconds: 1800,
  pointRetentionDays: 14,
  adapter: async (config) => {
    if (typeof config.lat !== 'number' || typeof config.lon !== 'number') {
      return {
        ok: false,
        error: { code: 'parse_failed', message: 'weather requires resolved lat/lon' },
      };
    }
    return weatherOpenMeteo({ lat: config.lat, lon: config.lon, location: config.location });
  },
};
