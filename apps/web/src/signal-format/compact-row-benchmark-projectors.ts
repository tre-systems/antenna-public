import type { DataPoint } from '../api';
import { strOf } from './common';
import type { CompactRow } from './compact-row-types';

export const aaHighlightRow = (
  p: DataPoint,
  rank: number,
  href: string | null,
): CompactRow | null => {
  const model = strOf(p.dimensions?.model);
  const metric = strOf(p.dimensions?.metric);
  const val = typeof p.value === 'number' ? p.value : Number(p.value);
  if (!model || !metric || !Number.isFinite(val)) return null;
  if (metric === 'aa_intelligence') return aaIntelligenceRow(rank, model, val, href);
  if (metric === 'aa_speed') return aaSpeedRow(rank, model, val, href);
  if (metric === 'aa_price') return aaPriceRow(rank, model, val, href);
  return null;
};

export const aaFrontierRow = (
  p: DataPoint,
  rank: number,
  href: string | null,
): CompactRow | null => {
  const model = strOf(p.dimensions?.model);
  const score = typeof p.value === 'number' ? p.value : Number(p.value);
  if (!model || !Number.isFinite(score)) return null;
  const speed = optionalNumber(p.dimensions?.speed);
  const price = optionalNumber(p.dimensions?.price);
  const details = [
    Number.isFinite(speed) ? `${Math.round(speed)} tok/s` : null,
    Number.isFinite(price) ? aaPriceChip(price) : null,
  ].filter((value): value is string => value !== null);
  return {
    rank,
    title: model,
    subtitle: details.length > 0 ? details.join(' · ') : 'Speed/price unavailable',
    chip: score.toFixed(1),
    chipTone: score >= 55 ? 'ok' : score >= 45 ? 'info' : 'muted',
    href,
  };
};

const optionalNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const tbenchRow = (p: DataPoint, rank: number, href: string | null): CompactRow | null => {
  const agent = strOf(p.dimensions?.agent);
  const model = strOf(p.dimensions?.model);
  const accuracy = typeof p.value === 'number' ? p.value : Number(p.value);
  if (!agent || !model || !Number.isFinite(accuracy)) return null;
  return {
    rank,
    title: agent,
    subtitle: model,
    chip: `${accuracy.toFixed(1)}%`,
    chipTone: accuracy >= 80 ? 'ok' : accuracy >= 65 ? 'info' : 'muted',
    href,
  };
};

const aaIntelligenceRow = (
  rank: number,
  title: string,
  val: number,
  href: string | null,
): CompactRow => ({
  rank,
  title,
  subtitle: null,
  chip: val.toFixed(1),
  chipTone: val >= 55 ? 'ok' : val >= 45 ? 'info' : 'muted',
  href,
});

const aaSpeedRow = (rank: number, title: string, val: number, href: string | null): CompactRow => ({
  rank,
  title,
  subtitle: null,
  chip: `${Math.round(val)} tok/s`,
  chipTone: val >= 100 ? 'ok' : val >= 50 ? 'info' : 'muted',
  href,
});

const aaPriceRow = (rank: number, title: string, val: number, href: string | null): CompactRow => ({
  rank,
  title,
  subtitle: null,
  chip: aaPriceChip(val),
  chipTone: val <= 1 ? 'ok' : val <= 5 ? 'info' : 'muted',
  href,
});

const aaPriceChip = (val: number): string => {
  if (val < 0.1) return `$${val.toFixed(3)}/M`;
  if (val < 1) return `$${val.toFixed(2)}/M`;
  return `$${val.toFixed(1)}/M`;
};
