// Keeps connector keys readable in approval forms without duplicating source policy.

const LABELS: Record<string, string> = {
  base: 'Base currency',
  quote: 'Quote currency',
  pairs: 'Pairs',
  tickers: 'Tickers',
  symbol: 'Symbol',
  preset: 'Preset',
  owner: 'Owner',
  repo: 'Repository',
  location: 'Location',
  lat: 'Latitude',
  lon: 'Longitude',
  calendarId: 'Calendar ID',
  hoursAhead: 'Hours ahead',
  url: 'URL',
  jsonPath: 'JSON path',
  value: 'Value',
  unit: 'Unit',
  label: 'Label',
  amount: 'Amount',
  currency: 'Currency',
  period: 'Period',
  provider: 'Provider',
  service: 'Service',
  project: 'Project',
  sourceUrl: 'Source URL',
  apiKey: 'API key',
  since: 'Since',
  limit: 'Limit',
};

const sentenceCase = (key: string): string => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (spaced.length === 0) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

export const configKeyLabel = (key: string): string => LABELS[key] ?? sentenceCase(key);
