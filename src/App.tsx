import { useEffect, useRef } from 'react';
import { ExportReminder } from './components/ExportReminder';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Practice } from './pages/Practice';
import { Preview } from './pages/Preview';
import { SectionSim } from './pages/SectionSim';
import { Settings } from './pages/Settings';
import { Strategies } from './pages/Strategies';
import { href, useRoute } from './router';
import { useProgress } from './store/progress';

const NAV: [string, string][] = [
  ['', 'Dashboard'],
  ['practice', 'Practice'],
  ['section', 'Section test'],
  ['strategies', 'Strategies'],
  ['history', 'History'],
  ['settings', 'Settings'],
];

export function App() {
  const route = useRoute();
  const theme = useProgress((s) => s.settings.theme);
  const motion = useProgress((s) => s.settings.motion ?? 'system');
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (motion === 'system') root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', motion);
  }, [motion]);

  const page = route[0] ?? '';

  // On a phone the nav is one scrolling line: bring the current page to its middle.
  useEffect(() => {
    const n = nav.current;
    const a = n?.querySelector('[aria-current]');
    if (n && a) n.scrollLeft += a.getBoundingClientRect().left - n.getBoundingClientRect().left - (n.clientWidth - a.clientWidth) / 2;
  }, [page]);

  let body;
  switch (page) {
    case 'practice':
      body = <Practice route={route.slice(1)} />;
      break;
    case 'section':
      body = <SectionSim />;
      break;
    case 'strategies':
      body = <Strategies focus={route[1]} />;
      break;
    case 'history':
      body = <History />;
      break;
    case 'settings':
      body = <Settings />;
      break;
    case 'preview':
      body = <Preview route={route.slice(1)} />;
      break;
    default:
      body = <Dashboard />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href()}>
            <span className="brand-mark">Q</span>
            <span className="brand-name">GRE Quant Trainer</span>
          </a>
          <nav className="nav" ref={nav}>
            {NAV.map(([p, label]) => (
              <a key={p} href={p ? href(p) : href()} className={page === p ? 'active' : undefined} aria-current={page === p ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <ExportReminder />
      <main>{body}</main>
    </div>
  );
}
