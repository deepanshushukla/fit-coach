import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useOrg } from '../lib/org';

const NAV_ITEMS = [
  { to: '/org', label: 'Overview' },
  { to: '/members', label: 'Members' },
  { to: '/applications', label: 'Applications' },
  { to: '/licences', label: 'Licences' },
  { to: '/plans', label: 'Plans' },
  { to: '/exercises', label: 'Exercise catalogue' },
  { to: '/usage', label: 'Usage' },
  { to: '/audit-log', label: 'Audit log' },
  { to: '/docs', label: 'SDK & docs' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { organisations, currentOrgId, setCurrentOrgId } = useOrg();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>FormCoach</h1>
        {organisations.length > 0 && (
          <select
            value={currentOrgId ?? ''}
            onChange={(e) => setCurrentOrgId(e.target.value)}
            style={{ marginBottom: '1rem' }}
          >
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          <div>{user?.email}</div>
          <button
            className="secondary"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
