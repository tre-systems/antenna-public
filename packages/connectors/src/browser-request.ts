// Stooq, Yahoo, Artificial Analysis and tbench all serve empty or error bodies
// to default fetch clients, so these requests present as a desktop browser.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

export const browserRequestInit = (accept: string): RequestInit => ({
  headers: {
    accept,
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': BROWSER_USER_AGENT,
  },
});

export const HTML_PAGE_REQUEST_INIT = browserRequestInit('text/html,application/xhtml+xml');
