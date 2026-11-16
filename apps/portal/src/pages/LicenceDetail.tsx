import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Licence {
  id: string;
  applicationId: string | null;
  planId: string;
  status: string;
  expiresAt: string;
  offlineGraceSeconds: number;
  entitlementVersion: number;
  exerciseOverrides: { exerciseId: string; access: string }[];
  plan: { name: string; code: string };
}

export function LicenceDetailPage() {
  const { licenceId } = useParams<{ licenceId: string }>();
  const [licence, setLicence] = useState<Licence | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function load() {
    if (!licenceId) return;
    const res = await api.get<Licence>(`/v1/licences/${licenceId}`);
    setLicence(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenceId]);

  async function onRevoke() {
    await api.post(`/v1/licences/${licenceId}/revoke`);
    load();
  }

  async function onReissue() {
    const res = await api.post<{ entitlementToken: string }>(`/v1/licences/${licenceId}/reissue-entitlement`);
    setLastAction(`Reissued. New token (first 40 chars): ${res.entitlementToken.slice(0, 40)}...`);
    load();
  }

  if (!licence) return <p>Loading...</p>;

  return (
    <div>
      <h2>Licence</h2>
      <div className="card">
        <table>
          <tbody>
            <tr>
              <th>Plan</th>
              <td>{licence.plan.name}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>
                <span className={`badge ${licence.status === 'ACTIVE' ? 'success' : 'danger'}`}>{licence.status}</span>
              </td>
            </tr>
            <tr>
              <th>Expires</th>
              <td>{new Date(licence.expiresAt).toLocaleString()}</td>
            </tr>
            <tr>
              <th>Offline grace</th>
              <td>{Math.round(licence.offlineGraceSeconds / 3600)} hours after expiry</td>
            </tr>
            <tr>
              <th>Entitlement version</th>
              <td>{licence.entitlementVersion}</td>
            </tr>
          </tbody>
        </table>
        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="secondary" onClick={onReissue} disabled={licence.status !== 'ACTIVE'}>
            Reissue entitlement
          </button>
          <button className="danger" onClick={onRevoke} disabled={licence.status !== 'ACTIVE'}>
            Revoke licence
          </button>
        </div>
        {lastAction && <p className="muted" style={{ marginTop: '0.75rem' }}>{lastAction}</p>}
      </div>

      {licence.exerciseOverrides.length > 0 && (
        <div className="card">
          <h3>Exercise overrides</h3>
          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {licence.exerciseOverrides.map((o) => (
                <tr key={o.exerciseId}>
                  <td>{o.exerciseId}</td>
                  <td>{o.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
