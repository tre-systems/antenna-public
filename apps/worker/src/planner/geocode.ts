type CityCoordinates = {
  readonly location: string;
  readonly lat: number;
  readonly lon: number;
};

const DEMO_CITY_COORDINATES: Readonly<Record<string, CityCoordinates>> = {
  berlin: { location: 'Berlin', lat: 52.52, lon: 13.405 },
  london: { location: 'London', lat: 51.5072, lon: -0.1276 },
  madrid: { location: 'Madrid', lat: 40.4168, lon: -3.7038 },
  manila: { location: 'Manila', lat: 14.5995, lon: 120.9842 },
  'new york': { location: 'New York', lat: 40.7128, lon: -74.006 },
  paris: { location: 'Paris', lat: 48.8566, lon: 2.3522 },
  singapore: { location: 'Singapore', lat: 1.3521, lon: 103.8198 },
  sydney: { location: 'Sydney', lat: -33.8688, lon: 151.2093 },
};

const normalizeLocation = (location: string): string =>
  location.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');

export const resolveDemoCity = (location: unknown): CityCoordinates | undefined => {
  if (typeof location !== 'string') return undefined;
  return DEMO_CITY_COORDINATES[normalizeLocation(location)];
};
