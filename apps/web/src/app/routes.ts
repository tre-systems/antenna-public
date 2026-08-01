// Shared-link routes skip auth bootstrap so anonymous collection views stay fast.
const PUBLIC_PATH_RE = /^\/c\/([^/?#]+)\/?$/;
const SETTINGS_TOKENS_PATH_RE = /^\/settings\/tokens\/?$/;

type AppRoute = {
  readonly publicSlug: string | null;
  readonly settingsTokensRoute: boolean;
  readonly selectedCollectionId: string | null;
};

export const readInitialAppRoute = (): AppRoute => {
  if (typeof window === 'undefined') return emptyRoute();
  const { pathname, search } = window.location;
  return {
    publicSlug: publicSlugFromPath(pathname),
    settingsTokensRoute: SETTINGS_TOKENS_PATH_RE.test(pathname),
    selectedCollectionId: selectedCollectionFromSearch(search),
  };
};

const emptyRoute = (): AppRoute => ({
  publicSlug: null,
  settingsTokensRoute: false,
  selectedCollectionId: null,
});

const publicSlugFromPath = (path: string): string | null => {
  const match = PUBLIC_PATH_RE.exec(path);
  return match ? decodeURIComponent(match[1] ?? '') : null;
};

const selectedCollectionFromSearch = (search: string): string | null => {
  const id = new URLSearchParams(search).get('collection');
  return id && id.length > 0 ? id : null;
};
