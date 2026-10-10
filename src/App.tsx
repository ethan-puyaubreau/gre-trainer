import { useEffect } from 'react';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Practice } from './pages/Practice';
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const page = route[0] ?? '';
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
    default:
      body = <Dashboard />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href()}>
            <span className="brand-mark">Q</span> GRE Quant Trainer
          </a>
          <nav className="nav">
            {NAV.map(([p, label]) => (
              <a key={p} href={p ? href(p) : href()} className={page === p ? 'active' : undefined}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main>{body}</main>
    </div>
  );
}
