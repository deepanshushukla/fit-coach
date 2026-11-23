import { NavLink, Outlet } from 'react-router-dom';

const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5173';

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/api', label: 'API reference' },
  { to: '/sdk', label: 'SDK' },
  { to: '/pricing', label: 'Pricing' },
];

export function TopNav() {
  return (
    <div>
      <header className="topnav">
        <NavLink to="/" className="brand">
          FormCoach
        </NavLink>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <a className="signin" href={PORTAL_URL}>
          Sign in
        </a>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
