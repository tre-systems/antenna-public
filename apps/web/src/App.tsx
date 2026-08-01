import { useState } from 'preact/hooks';
import { CollectionExperience } from './app/CollectionExperience';
import { useAuthSession } from './app/auth-state';
import { useCollectionState, useSelectedCollectionSignal } from './app/collection-state';
import { useOnboardingState } from './app/onboarding-state';
import { readInitialAppRoute } from './app/routes';
import { PublicCollection } from './pages/PublicCollection';
import { SettingsTokens } from './pages/SettingsTokens';
import { SignIn } from './pages/SignIn';

export function App() {
  const [route] = useState(() => readInitialAppRoute());
  const skipSessionProbe = route.publicSlug !== null;
  const auth = useAuthSession(skipSessionProbe);
  const signedIn = auth.state.kind === 'signed-in';
  const collection = useCollectionState(signedIn, route.selectedCollectionId);
  const onboarding = useOnboardingState(auth.setSignedInUser);

  useSelectedCollectionSignal(route.selectedCollectionId);

  if (route.publicSlug !== null) {
    return <PublicCollection slug={route.publicSlug} />;
  }

  if (auth.state.kind === 'loading') {
    return <LoadingScreen />;
  }

  if (auth.state.kind === 'signed-out') {
    return <SignIn />;
  }

  if (route.settingsTokensRoute && auth.state.kind === 'signed-in') {
    return <SettingsTokens />;
  }

  if (auth.state.kind === 'error') {
    return <SessionError message={auth.state.message} />;
  }

  return (
    <CollectionExperience
      user={auth.state.user}
      collection={collection.collection}
      selectedCollectionId={route.selectedCollectionId}
      signingOut={auth.signingOut}
      onboarding={onboarding}
      onSaveTitle={collection.saveTitle}
      onSaveVisibility={collection.saveVisibility}
      onSignOut={auth.signOutUser}
    />
  );
}

const LoadingScreen = () => (
  <main class="flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400">
    Loading…
  </main>
);

const SessionError = ({ message }: { readonly message: string }) => (
  <main class="mx-auto max-w-md p-6 text-sm">
    <p class="text-rose-700 dark:text-rose-300">Couldn't check your session.</p>
    <p class="mt-1 text-slate-500 dark:text-slate-400">{message}</p>
  </main>
);
