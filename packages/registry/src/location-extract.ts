// Capture location prose conservatively for later user confirmation.
const LOCATION_RX = /\b(?:in|at|where)\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?:[?.,!]|$)/i;

export const extractLocation = (prompt: string): string | undefined => {
  const match = LOCATION_RX.exec(prompt);
  return match?.[1]?.trim();
};
