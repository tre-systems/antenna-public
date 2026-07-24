// Free-text after "in" / "at" / "where" — naive on purpose; the planner will
// confirm with the user. Stops at end-of-string or common sentence punctuation.
const LOCATION_RX = /\b(?:in|at|where)\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?:[?.,!]|$)/i;

export const extractLocation = (prompt: string): string | undefined => {
  const match = LOCATION_RX.exec(prompt);
  return match?.[1]?.trim();
};
