export const logDigest = (payload: Readonly<Record<string, unknown>>): void => {
  console.log(JSON.stringify(payload));
};
