import { useEffect, useState } from 'react';

/** decodeURIComponent throws on a malformed escape such as "50%": keep the raw segment then. */
export function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Hash routing (GitHub Pages serves a single index.html). Returns path segments after "#/". */
export function useRoute(): string[] {
  const read = () =>
    window.location.hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeSegment);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/');

export function go(...parts: string[]) {
  window.location.hash = href(...parts);
}
