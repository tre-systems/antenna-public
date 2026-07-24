import { useCallback, useRef, useState } from 'preact/hooks';
import type { CollectionListItem } from '../api';
import { CollectionDeleteDialog } from './CollectionDeleteDialog';
import { CollectionSwitcherMenu } from './collection-switcher/CollectionSwitcherMenu';
import { CollectionSwitcherTrigger } from './collection-switcher/CollectionSwitcherTrigger';
import type { CollectionSwitcherProps } from './collection-switcher/types';
import { useCollectionList } from './collection-switcher/use-collection-list';
import { useMenuDismiss } from './collection-switcher/use-menu-dismiss';
import { collectionUrl } from './collection-switcher/url';

export function CollectionSwitcher({
  activeId,
  primaryTitle,
  onCreateClick,
}: CollectionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CollectionListItem | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { collections, loadError, setCollections } = useCollectionList(open);
  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);
  useMenuDismiss(open, rootRef, closeMenu);

  const activeTitle =
    activeId !== null && collections
      ? (collections.find((collection) => collection.id === activeId)?.title ?? 'Collection')
      : primaryTitle;

  const handleDeleted = (id: string): void => {
    const remaining = (collections ?? []).filter((collection) => collection.id !== id);
    const deletedCurrent = activeId === id || (activeId === null && id === collections?.[0]?.id);
    setCollections(remaining);
    setDeleteTarget(null);
    setOpen(false);
    if (deletedCurrent && typeof window !== 'undefined') {
      window.location.assign(collectionUrl(remaining[0]?.id ?? null));
    }
  };

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
      }}
      class="relative"
    >
      <CollectionSwitcherTrigger
        activeTitle={activeTitle}
        open={open}
        onToggle={() => {
          setOpen((prev) => !prev);
        }}
      />
      {open ? (
        <CollectionSwitcherMenu
          activeId={activeId}
          collections={collections}
          loadError={loadError}
          onDeleteClick={(collection) => {
            setOpen(false);
            setDeleteTarget(collection);
          }}
          onCreateClick={() => {
            setOpen(false);
            onCreateClick();
          }}
        />
      ) : null}
      {deleteTarget ? (
        <CollectionDeleteDialog
          collection={deleteTarget}
          onClose={() => {
            setDeleteTarget(null);
          }}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
