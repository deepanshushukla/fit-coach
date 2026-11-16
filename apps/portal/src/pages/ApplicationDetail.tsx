import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';

interface Environment {
  id: string;
  name: string;
  publicIdentifier: string;
  status: string;
  allowedSdkVersions: string[];
  credentialStatus: string;
  lastUsedAt: string | null;
}

interface Application {
  id: string;
  name: string;
  platforms: string[];
  environments: Environment[];
}

const ENV_NAMES = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [envName, setEnvName] = useState('DEVELOPMENT');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!applicationId) return;
    const res = await api.get<Application>(`/v1/applications/${applicationId}`);
    setApplication(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function onCreateEnv(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/v1/applications/${applicationId}/environments`, { name: envName });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to create environment.');
    }
  }

  async function onRotate(environmentId: string) {
    await api.post(`/v1/environments/${environmentId}/rotate-credential`);
    load();
  }

  if (!application) return <p>Loading...</p>;

  return (
    <div>
      <h2>{application.name}</h2>
      <p className="muted">Platforms: {application.platforms.join(', ')}</p>

      <div className="card">
        <h3>Add environment</h3>
        <form onSubmit={onCreateEnv}>
          <div className="row">
            <div>
              <label htmlFor="envName">Environment</label>
              <select id="envName" value={envName} onChange={(e) => setEnvName(e.target.value)}>
                {ENV_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit">Add</button>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
        </form>
      </div>

      <div className="card">
        <h3>Environments</h3>
        {application.environments.length === 0 && <p className="muted">No environments yet.</p>}
        {application.environments.map((env) => (
          <div key={env.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
            <div className="topbar" style={{ marginBottom: '0.25rem' }}>
              <strong>{env.name}</strong>
              <span className="badge">{env.status}</span>
            </div>
            <p className="muted">
              Public identifier (embed this in your app — it is not a secret):
            </p>
            <pre>{env.publicIdentifier}</pre>
            <p className="muted">Credential status: {env.credentialStatus} · Last used: {env.lastUsedAt ? new Date(env.lastUsedAt).toLocaleString() : 'never'}</p>
            <button className="secondary" onClick={() => onRotate(env.id)}>
              Rotate public identifier
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
