export const SPARKLINE_WIDTH = 240;
export const SPARKLINE_HEIGHT = 72;
export const SPARKLINE_PAD = 4;

export type SeriesPoint = {
  readonly ts: number;
  readonly value: number;
};

export type SeriesWithLabel = {
  readonly label: string;
  readonly points: SeriesPoint[];
};

export type SeriesBounds = {
  readonly minTs: number;
  readonly maxTs: number;
  readonly minValue: number;
  readonly maxValue: number;
  readonly spanTs: number;
  readonly spanValue: number;
};

export type ChangeStyle = {
  readonly colour: string;
  readonly label: string;
};
