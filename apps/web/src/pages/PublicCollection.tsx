import { PRODUCT_NAME } from '../brand';
import { PublicBody } from './public-collection/PublicBody';
import { PublicHeader } from './public-collection/PublicHeader';
import { usePublicCollection } from './public-collection/use-public-collection';

type Props = { readonly slug: string };

export function PublicCollection({ slug }: Props) {
  const collection = usePublicCollection(slug);

  return (
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PublicHeader
        title={
          collection.state.kind === 'ready' ? collection.state.data.collection.title : PRODUCT_NAME
        }
        collection={
          collection.state.kind === 'ready' ? collection.state.data.collection : undefined
        }
      />
      <PublicBody slug={slug} state={collection.state} />
    </main>
  );
}
