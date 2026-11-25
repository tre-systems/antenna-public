import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { retryAuthRead } from './auth-read-retry';

type Factory = ReturnType<typeof drizzleAdapter>;
type Lookup = Parameters<ReturnType<Factory>['findOne']>[0];

export const sessionAdapter = (...args: Parameters<typeof drizzleAdapter>): Factory => {
  const create = drizzleAdapter(...args);
  return (options) => {
    const storage = create(options);
    return {
      ...storage,
      findOne: <T>(query: Lookup) => {
        const read = () => storage.findOne<T>(query);
        // Better Auth's findSession reads the session and its owner. getSession itself may write.
        return query.model === 'session' &&
          query.where.length === 1 &&
          query.where[0]?.field === 'token' &&
          query.join?.user === true
          ? retryAuthRead(read)
          : read();
      },
    };
  };
};
