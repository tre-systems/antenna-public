import { useEffect, useState } from 'preact/hooks';
import { ThemeToggle } from '../components/ThemeToggle';
import { readErrorFromQuery, startGoogleSignIn } from './sign-in/auth';
import { CollectionPreview } from './sign-in/CollectionPreview';
import { SignInIntroduction } from './sign-in/Preview';
import { SignInCard } from './sign-in/SignInCard';
import type { SignInError } from './sign-in/types';

export function SignIn() {
  const [error, setError] = useState<SignInError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setError(readErrorFromQuery());
  }, []);

  const submit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await startGoogleSignIn();
    } catch (err) {
      setError({ kind: 'generic', raw: err instanceof Error ? err.message : 'sign-in failed' });
      setIsSubmitting(false);
    }
  };

  return (
    <main class="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto flex max-w-6xl justify-end">
        <ThemeToggle />
      </div>
      <div class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-x-8 gap-y-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SignInIntroduction />
        <SignInCard
          error={error}
          isSubmitting={isSubmitting}
          onSubmit={() => {
            void submit();
          }}
        />
        <CollectionPreview />
      </div>
    </main>
  );
}
