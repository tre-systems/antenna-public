import { describe, expect, it } from 'vitest';
import { runTokenCli } from './token-cli';

describe('runTokenCli', () => {
  it('does not offer the retired create command', async () => {
    let error = '';
    const code = await runTokenCli({
      args: ['create', 'Claude Code'],
      env: {
        ANTENNA_BASE_URL: 'https://collection.example',
        ANTENNA_SESSION: 'session-value',
      },
      fetchImpl: jsonFetch([], {}),
      writeError: (text) => {
        error += text;
      },
    });

    expect(code).toBe(1);
    expect(error).toContain('Unknown command "create"');
    expect(error).not.toContain('antenna-mcp-token create');
  });

  it('lists tokens with bearer auth', async () => {
    const requests: Request[] = [];
    let output = '';

    const code = await runTokenCli({
      args: ['list'],
      env: { ANTENNA_BASE_URL: 'https://collection.example', ANTENNA_TOKEN: 'pbk_existing' },
      fetchImpl: jsonFetch(requests, [
        {
          id: 'token-1',
          label: 'Local',
          created_at: 1,
          last_used_at: null,
          revoked_at: null,
        },
      ]),
      write: (text) => {
        output += text;
      },
    });

    expect(code).toBe(0);
    expect(output).toContain('token-1');
    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer pbk_existing');
  });

  it('revokes a token id', async () => {
    const requests: Request[] = [];

    const code = await runTokenCli({
      args: ['revoke', 'token/1'],
      env: { ANTENNA_BASE_URL: 'https://collection.example', ANTENNA_TOKEN: 'pbk_existing' },
      fetchImpl: jsonFetch(requests, { revoked: true }),
      write: () => undefined,
    });

    expect(code).toBe(0);
    expect(requests[0]?.url).toBe('https://collection.example/api/mcp-tokens/token%2F1');
    expect(requests[0]?.method).toBe('DELETE');
  });

  it('returns failure when auth env is missing', async () => {
    let error = '';

    const code = await runTokenCli({
      args: ['list'],
      env: {},
      fetchImpl: jsonFetch([], []),
      writeError: (text) => {
        error += text;
      },
    });

    expect(code).toBe(1);
    expect(error).toContain('ANTENNA_SESSION or ANTENNA_TOKEN');
  });

  it('requires an explicit deployment base URL', async () => {
    let error = '';

    const code = await runTokenCli({
      args: ['list'],
      env: { ANTENNA_TOKEN: 'pbk_existing' },
      fetchImpl: jsonFetch([], []),
      writeError: (text) => {
        error += text;
      },
    });

    expect(code).toBe(1);
    expect(error).toContain('ANTENNA_BASE_URL');
  });
});

function jsonFetch(requests: Request[], body: unknown): typeof fetch {
  return (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(Response.json(body));
  };
}
