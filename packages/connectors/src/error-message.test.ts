import { describe, expect, it } from 'vitest';
import { errorMessage } from './error-message';

describe('connector exception privacy', () => {
  it.each([
    new Error('https://example.test/?apiKey=secret'),
    new SyntaxError('Private source row: secret'),
    'secret',
    { token: 'secret' },
  ])('never copies raw exception details into status or points', (error) => {
    expect(errorMessage(error)).not.toContain('secret');
  });
  it('retains useful timeout classification without exception messages', () => {
    expect(errorMessage(new DOMException('secret', 'TimeoutError'))).toBe(
      'Source request timed out',
    );
  });
});
