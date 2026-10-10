/** True when animations should be skipped: the in-app setting wins over the system preference. */
export function reducedMotion(): boolean {
  const m = document.documentElement.getAttribute('data-motion');
  return m === 'off' || (m !== 'on' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false));
}
