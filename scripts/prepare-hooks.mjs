// npm sets NODE_ENV=production for lifecycle scripts when dev dependencies are omitted.
if (process.env.NODE_ENV !== 'production') {
  const { default: install } = await import('husky');
  process.stdout.write(install());
}
