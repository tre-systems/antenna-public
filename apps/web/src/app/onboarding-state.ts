import { useCallback, useState } from 'preact/hooks';
import { completeOnboarding, type User } from '../auth';

export const useOnboardingState = (setSignedInUser: (user: User) => void) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusAsk, setFocusAsk] = useState(false);

  const markComplete = useCallback(async (): Promise<User> => {
    const updated = await completeOnboarding();
    setSignedInUser(updated);
    return updated;
  }, [setSignedInUser]);

  const complete = useCallback(
    async (after?: () => void | Promise<void>): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        await markComplete();
        await after?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not finish onboarding.');
      } finally {
        setSaving(false);
      }
    },
    [markComplete],
  );

  const completeThenFocusAsk = useCallback(async (): Promise<void> => {
    await complete(() => {
      setFocusAsk(true);
    });
  }, [complete]);

  return { saving, error, focusAsk, markComplete, complete, completeThenFocusAsk };
};
