import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useOrg } from '../lib/org';

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export function AuditLogPage() {
  const { currentOrgId } = useOrg();
  const [logs, setLogs] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (currentOrgId) api.get<AuditEntry[]>(`/v1/organisations/${currentOrgId}/audit-logs`).then(setLogs);
  }, [currentOrgId]);

  return (
    <div>
      <h2>Audit log</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Resource</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="muted">{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.action}</td>
                <td className="muted">
                  {l.resourceType} <code>{l.resourceId}</code>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No audit events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
