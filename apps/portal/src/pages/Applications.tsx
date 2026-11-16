import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useOrg } from '../lib/org';

interface Application {
  id: string;
  name: string;
  platforms: string[];
  status: string;
  createdAt: string;
}

const PLATFORMS = ['ios', 'android', 'react-native', 'expo', 'flutter'];

export function ApplicationsPage() {
  const { currentOrgId } = useOrg();
  const [applications, setApplications] = useState<Application[]>([]);
  const [name, setName] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['react-native']);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    const res = await api.get<Application[]>(`/v1/organisations/${currentOrgId}/applications`);
    setApplications(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/v1/organisations/${currentOrgId}/applications`, { name, platforms });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to create application.');
    }
  }

  return (
    <div>
      <h2>Applications</h2>
      <div className="card">
        <h3>Create an application</h3>
        <form onSubmit={onCreate}>
          <label htmlFor="appName">Name</label>
          <input id="appName" required value={name} onChange={(e) => setName(e.target.value)} />
          <label>Platforms</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {PLATFORMS.map((p) => (
              <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 'unset' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
                {p}
              </label>
            ))}
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={platforms.length === 0}>
            Create application
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Platforms</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link to={`/applications/${a.id}`}>{a.name}</Link>
                </td>
                <td className="muted">{a.platforms.join(', ')}</td>
                <td>
                  <span className="badge">{a.status}</span>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No applications yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
