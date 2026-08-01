// The non-DOM test can only verify the pre-prompt render.

import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { InstallPrompt } from './InstallPrompt';

describe('InstallPrompt', () => {
  it('renders nothing until the browser fires beforeinstallprompt', () => {
    expect(renderToString(<InstallPrompt />)).toBe('');
  });
});
