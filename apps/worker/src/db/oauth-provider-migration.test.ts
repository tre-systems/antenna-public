import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { OAUTH_BASE_DDL, OAUTH_MIGRATION } from '../auth/oauth-provider-test-fixtures';

describe('0004 OAuth provider migration', () => {
  it('fails before changing legacy grants if duplicate account identities need review', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(OAUTH_BASE_DDL);
    sqlite.exec(`INSERT INTO account (id,user_id,account_id,provider_id,created_at,updated_at) VALUES
      ('one','owner','same','google',0,0), ('two','owner','same','google',0,0);
      INSERT INTO oauth_access_token VALUES ('grant',9999999999999,9999999999999);`);
    expect(() => sqlite.exec(OAUTH_MIGRATION)).toThrow('UNIQUE constraint failed');
    expect(
      sqlite.prepare('SELECT access_token_expires_at FROM oauth_access_token').pluck().get(),
    ).toBe(9999999999999);
  });
  it('creates the new provider schema, expires legacy grants, and preserves user and session records', () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(OAUTH_BASE_DDL);
    sqlite.exec(`INSERT INTO user (id,email,name,created_at,updated_at) VALUES ('owner','one@test','One',0,0);
      INSERT INTO session (id,user_id,token,expires_at,created_at,updated_at) VALUES ('session','owner','cookie',9999999999999,0,0);
      INSERT INTO oauth_application VALUES ('legacy','client',0);
      INSERT INTO oauth_access_token VALUES ('grant',9999999999999,9999999999999);`);
    sqlite.exec(OAUTH_MIGRATION);
    expect(sqlite.prepare('SELECT disabled FROM oauth_application').pluck().get()).toBe(1);
    expect(
      sqlite
        .prepare('SELECT access_token_expires_at,refresh_token_expires_at FROM oauth_access_token')
        .get(),
    ).toEqual({ access_token_expires_at: 0, refresh_token_expires_at: 0 });
    expect(sqlite.prepare('SELECT id FROM user').pluck().all()).toEqual(['owner']);
    expect(sqlite.prepare('SELECT token FROM session').pluck().get()).toBe('cookie');
    for (const table of [
      'oauth2_client',
      'oauth2_access_token',
      'oauth2_refresh_token',
      'oauth2_consent',
      'oauth2_resource',
      'oauth2_client_resource',
      'oauth2_client_assertion',
      'jwks',
    ]) {
      expect(sqlite.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
  });
});
