import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useOrg } from '../lib/org';

export function OrgSetupPage() {
  const navigate = useNavigate();
  const { organisations, loading, refresh, setCurrentOrgId } = useOrg();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && organisations.length > 0) navigate('/org', { replace: true });
  }, [loading, organisations, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const org = await api.post<{ id: string }>('/v1/organisations', { name });
      await refresh();
      setCurrentOrgId(org.id);
      navigate('/org');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to create organisation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 420 }}>
        <h2>Create your organisation</h2>
        <p className="muted">This is the account that owns your applications, licences and billing.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="orgName">Organisation name</label>
          <input id="orgName" required value={name} onChange={(e) => setName(e.target.value)} />
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create organisation'}
          </button>
        </form>
      </div>
    </div>
  );
}
