export type WeatherCondition =
  'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm';

export type WeatherForecastHour = {
  readonly hourOffset: number;
  readonly ts: number;
  readonly condition: WeatherCondition;
  readonly temp: number;
  readonly rainProb: number | null;
  readonly code: number | null;
};

export type WeatherCardData = {
  readonly tempText: string;
  readonly tempUnit: string;
  readonly tempDescriptor: string;
  readonly windDescriptor: string;
  readonly humidity: string;
  readonly windSpeed: string;
  readonly windUnit: string;
  readonly condition: WeatherCondition | null;
  readonly weatherCode: number | null;
  readonly apparentTemp: number | null;
  readonly feelsLikeC: number | null;
  readonly precipitation: number | null;
  readonly uvIndex: number | null;
  readonly isDay: boolean | null;
  readonly forecast: ReadonlyArray<WeatherForecastHour>;
  readonly advice: string;
};
