import { useOrg } from '../lib/org';
import { Navigate } from 'react-router-dom';

export function OrgOverviewPage() {
  const { currentOrg, loading, organisations } = useOrg();

  if (loading) return <p>Loading...</p>;
  if (organisations.length === 0) return <Navigate to="/org-setup" replace />;
  if (!currentOrg) return <p>Select an organisation.</p>;

  return (
    <div>
      <div className="topbar">
        <h2>{currentOrg.name}</h2>
        <span className="badge">{currentOrg.myRole}</span>
      </div>
      <div className="card">
        <h3>Organisation</h3>
        <table>
          <tbody>
            <tr>
              <th>ID</th>
              <td><code>{currentOrg.id}</code></td>
            </tr>
            <tr>
              <th>Slug</th>
              <td><code>{currentOrg.slug}</code></td>
            </tr>
            <tr>
              <th>Your role</th>
              <td>{currentOrg.myRole}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Quick start</h3>
        <ol className="muted">
          <li>Create an application and environment under Applications.</li>
          <li>Assign a plan to the application under Licences.</li>
          <li>Use the environment's public identifier to integrate the SDK — see SDK & docs.</li>
        </ol>
      </div>
    </div>
  );
}
