// Renders via preact-render-to-string — same lightweight pattern as the
// other component tests. We can't simulate `beforeinstallprompt` in a
// non-DOM environment, so this just verifies the default null render.

import { describe, expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import { InstallPrompt } from './InstallPrompt';

describe('InstallPrompt', () => {
  it('renders nothing until the browser fires beforeinstallprompt', () => {
    expect(renderToString(<InstallPrompt />)).toBe('');
  });
});
