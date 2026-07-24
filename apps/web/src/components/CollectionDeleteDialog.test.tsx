import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import type { CollectionListItem } from '../api';
import {
  canConfirmCollectionDelete,
  collectionDeleteErrorMessage,
  CollectionDeleteDialog,
} from './CollectionDeleteDialog';

const collection: CollectionListItem = {
  id: 'collection-1',
  title: 'Trading desk',
  description: null,
  visibility: 'private',
  slug: null,
  updated_at: 0,
  signal_count: 3,
};

describe('CollectionDeleteDialog', () => {
  it('renders the typed-confirm delete dialog with a disabled submit by default', () => {
    const html = renderToString(
      <CollectionDeleteDialog collection={collection} onClose={() => {}} onDeleted={() => {}} />,
    );

    expect(html).toContain('data-testid="delete-collection-dialog"');
    expect(html).toContain('Delete collection');
    expect(html).toContain('Trading desk');
    expect(html).toContain('Type the collection title to confirm');
    expect(html).toContain('data-testid="delete-collection-submit"');
    expect(html).toContain('disabled');
  });

  it('requires an exact title match before allowing delete', () => {
    expect(canConfirmCollectionDelete('Trading desk', 'Trading desk')).toBe(true);
    expect(canConfirmCollectionDelete('trading desk', 'Trading desk')).toBe(false);
    expect(canConfirmCollectionDelete('Trading desk ', 'Trading desk')).toBe(false);
  });

  it('maps server delete failures to clear owner-facing copy', () => {
    expect(
      collectionDeleteErrorMessage(new Error('DELETE /api/collections/a → 409: last_collection')),
    ).toBe("You can't delete your final collection.");
    expect(
      collectionDeleteErrorMessage(new Error('DELETE /api/collections/a → 404: not_found')),
    ).toBe('Collection was already deleted or is unavailable.');
  });
});
