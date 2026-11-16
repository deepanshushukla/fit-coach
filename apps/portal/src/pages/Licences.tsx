import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useOrg } from '../lib/org';

interface Licence {
  id: string;
  applicationId: string | null;
  planId: string;
  status: string;
  expiresAt: string;
  entitlementVersion: number;
}

interface Application {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  exerciseIds: string[];
}

export function LicencesPage() {
  const { currentOrgId } = useOrg();
  const [licences, setLicences] = useState<Licence[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [planId, setPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    const [l, a, p] = await Promise.all([
      api.get<Licence[]>(`/v1/organisations/${currentOrgId}/licences`),
      api.get<Application[]>(`/v1/organisations/${currentOrgId}/applications`),
      api.get<Plan[]>('/v1/plans'),
    ]);
    setLicences(l);
    setApplications(a);
    setPlans(p);
    if (!applicationId && a.length > 0) setApplicationId(a[0].id);
    if (!planId && p.length > 0) setPlanId(p[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/v1/organisations/${currentOrgId}/licences`, {
        applicationId,
        planId,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to create licence.');
    }
  }

  function appName(id: string | null) {
    return applications.find((a) => a.id === id)?.name ?? id ?? 'Org-wide';
  }
  function planName(id: string) {
    return plans.find((p) => p.id === id)?.name ?? id;
  }

  return (
    <div>
      <h2>Licences</h2>
      <div className="card">
        <h3>Assign a licence</h3>
        {applications.length === 0 || plans.length === 0 ? (
          <p className="muted">Create an application first, and make sure at least one plan exists.</p>
        ) : (
          <form onSubmit={onCreate}>
            <div className="row">
              <div>
                <label htmlFor="licApp">Application</label>
                <select id="licApp" value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="licPlan">Plan</label>
                <select id="licPlan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="licExpires">Expires</label>
                <input id="licExpires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <button type="submit">Create licence</button>
          </form>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Entitlement v</th>
            </tr>
          </thead>
          <tbody>
            {licences.map((l) => (
              <tr key={l.id}>
                <td>
                  <Link to={`/licences/${l.id}`}>{appName(l.applicationId)}</Link>
                </td>
                <td>{planName(l.planId)}</td>
                <td>
                  <span className={`badge ${l.status === 'ACTIVE' ? 'success' : l.status === 'REVOKED' ? 'danger' : ''}`}>
                    {l.status}
                  </span>
                </td>
                <td className="muted">{new Date(l.expiresAt).toLocaleDateString()}</td>
                <td>{l.entitlementVersion}</td>
              </tr>
            ))}
            {licences.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No licences yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
