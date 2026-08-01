export type SentBody = {
  readonly query: string;
  readonly variables: {
    readonly account: string;
    readonly trendStart: string;
    readonly trendEnd: string;
    readonly previousStart: string;
    readonly currentStart: string;
    readonly end: string;
  };
};

export const ACCOUNT_ID = 'a'.repeat(32);
export const baseConfig = { accountId: ACCOUNT_ID, apiToken: 'cf-token' };

export const gqlResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

export const fleetPayload = {
  data: {
    viewer: {
      accounts: [
        {
          daily: [
            { sum: { requests: 100, errors: 1 }, dimensions: { date: '2026-07-10' } },
            { sum: { requests: 250, errors: 0 }, dimensions: { date: '2026-07-11' } },
          ],
          current: [
            {
              sum: { requests: 290, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'success' },
            },
            {
              sum: { requests: 2, errors: 2 },
              dimensions: { scriptName: 'antenna', status: 'scriptThrewException' },
            },
            {
              sum: { requests: 8, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'clientDisconnected' },
            },
            {
              sum: { requests: 50, errors: 0 },
              dimensions: { scriptName: 'cepheus', status: 'success' },
            },
          ],
          previous: [
            {
              sum: { requests: 199, errors: 0 },
              dimensions: { scriptName: 'antenna', status: 'success' },
            },
            {
              sum: { requests: 1, errors: 1 },
              dimensions: { scriptName: 'antenna', status: 'scriptThrewException' },
            },
          ],
        },
      ],
    },
  },
};
