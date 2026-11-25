export const dailyResponse = (date: string, host: string, visits: number): Response =>
  Response.json({
    data: {
      viewer: {
        accounts: [
          {
            recent: [
              {
                count: visits,
                avg: { sampleInterval: 1 },
                sum: { visits },
                dimensions: { date, requestHost: host },
              },
            ],
          },
        ],
      },
    },
  });

export const sampledResponse = (): Response =>
  Response.json({
    data: {
      viewer: {
        accounts: [
          {
            recent: [
              {
                count: 100,
                avg: { sampleInterval: 100 },
                sum: { visits: 100 },
                dimensions: { date: '2026-08-01', requestHost: 'active.example' },
              },
            ],
            previous: [],
            lookback: [],
          },
        ],
      },
    },
  });
