export type BatchParam = string | number | null;

export type BatchStatement = {
  readonly sql: string;
  readonly params: ReadonlyArray<BatchParam>;
};

type BatchCapableD1 = D1Database & {
  prepare: (sql: string) => { bind: (...params: ReadonlyArray<BatchParam>) => D1PreparedStatement };
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

export const runD1Batch = async (
  binding: D1Database,
  statements: ReadonlyArray<BatchStatement>,
): Promise<boolean> => {
  if (!canBatch(binding)) return false;
  await binding.batch(
    statements.map((statement) => binding.prepare(statement.sql).bind(...statement.params)),
  );
  return true;
};

const canBatch = (binding: D1Database): binding is BatchCapableD1 =>
  typeof binding.prepare === 'function' && typeof binding.batch === 'function';
