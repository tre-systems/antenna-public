import type { CollectionListItem } from '../../api';

export type CollectionSwitcherProps = {
  readonly activeId: string | null;
  readonly primaryTitle: string;
  readonly onCreateClick: () => void;
};

export type CollectionSwitcherMenuProps = {
  readonly activeId: string | null;
  readonly collections: CollectionListItem[] | null;
  readonly loadError: string | null;
  readonly onCreateClick: () => void;
  readonly onDeleteClick: (collection: CollectionListItem) => void;
};
