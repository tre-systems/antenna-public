import type { ApiSignal, PublicApiSignal, SharedApiSignal } from './signal-types';
import type { Visibility } from './source-types';

export interface CollectionLayoutSlot {
  readonly signal_id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CollectionLayout {
  readonly version: number;
  readonly slots: ReadonlyArray<CollectionLayoutSlot>;
}

export interface CollectionRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: Visibility;
  readonly slug: string | null;
  readonly layout: CollectionLayout | null;
  readonly updated_at: number;
  readonly last_seen_at?: number | null;
}

export type CollectionListItem = Pick<
  CollectionRecord,
  'id' | 'title' | 'description' | 'visibility' | 'slug' | 'updated_at'
> & {
  readonly signal_count: number;
};

export interface CollectionListResponse {
  readonly collections: ReadonlyArray<CollectionListItem>;
}

export interface CollectionDeleteResponse {
  readonly deleted: true;
  readonly id: string;
}

export interface CollectionDetailResponse {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<ApiSignal>;
}

export interface CollectionSignalOrderRecord {
  readonly updated: true;
  readonly ordered_signal_ids: ReadonlyArray<string>;
}

export interface CollectionTemplateSignalRecord {
  readonly template_id: string;
  readonly display_name: string;
  readonly title: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly refresh_seconds?: number;
}

export interface CollectionTemplateRecord {
  readonly id: string;
  readonly kind: 'curated';
  readonly label: string;
  readonly description: string;
  readonly summary: string;
  readonly signals: ReadonlyArray<CollectionTemplateSignalRecord>;
}

export interface CollectionTemplateListResponse {
  readonly templates: ReadonlyArray<CollectionTemplateRecord>;
}

export interface CollectionQuota {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly can_create: boolean;
}

export interface MeResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly image_url: string | null;
  readonly first_seen_at: number;
  readonly onboarded_at: number | null;
  readonly collection_quota: CollectionQuota;
}

export type PublicCollectionListItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly owner_display_name: string;
  readonly updated_at: number;
  readonly signal_count: number;
};

export type PublicCollectionListResponse = {
  readonly collections: ReadonlyArray<PublicCollectionListItem>;
  readonly next_offset: number | null;
};

export type PublicCollectionResponse = {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<PublicApiSignal>;
};

export type SharedCollectionResponse = {
  readonly collection: CollectionRecord;
  readonly signals: ReadonlyArray<SharedApiSignal>;
};
