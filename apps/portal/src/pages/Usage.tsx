import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useOrg } from '../lib/org';

interface UsageGroup {
  applicationId: string;
  environmentId: string;
  exerciseId: string | null;
  eventType: string;
  _count: { _all: number };
}

export function UsagePage() {
  const { currentOrgId } = useOrg();
  const [usage, setUsage] = useState<UsageGroup[]>([]);

  useEffect(() => {
    if (currentOrgId) api.get<UsageGroup[]>(`/v1/organisations/${currentOrgId}/usage`).then(setUsage);
  }, [currentOrgId]);

  return (
    <div>
      <h2>Usage</h2>
      <p className="muted">Coarse-grained, batched event counts — no raw frames, images or per-frame events are ever recorded.</p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Exercise</th>
              <th>Event type</th>
              <th>Application</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((u, i) => (
              <tr key={i}>
                <td>{u.exerciseId ?? '—'}</td>
                <td>{u.eventType}</td>
                <td className="muted">{u.applicationId}</td>
                <td>{u._count._all}</td>
              </tr>
            ))}
            {usage.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No usage recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
