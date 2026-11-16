import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiRequestError } from '../lib/api';
import { useOrg } from '../lib/org';

interface Member {
  id: string;
  role: string;
  user: { id: string; email: string };
  createdAt: string;
}

const ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'ANALYST'];

export function MembersPage() {
  const { currentOrgId } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    const res = await api.get<Member[]>(`/v1/organisations/${currentOrgId}/members`);
    setMembers(res);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteToken(null);
    try {
      const res = await api.post<{ devInviteToken?: string }>(`/v1/organisations/${currentOrgId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteToken(res.devInviteToken ?? null);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to send invitation.');
    }
  }

  async function onRoleChange(memberId: string, role: string) {
    await api.patch(`/v1/organisations/${currentOrgId}/members/${memberId}`, { role });
    load();
  }

  async function onRemove(memberId: string) {
    await api.delete(`/v1/organisations/${currentOrgId}/members/${memberId}`);
    load();
  }

  return (
    <div>
      <h2>Members</h2>
      <div className="card">
        <h3>Invite a member</h3>
        <form onSubmit={onInvite}>
          <div className="row">
            <div>
              <label htmlFor="inviteEmail">Email</label>
              <input id="inviteEmail" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inviteRole">Role</label>
              <select id="inviteRole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="error-text">{error}</div>}
          <button type="submit">Send invitation</button>
        </form>
        {inviteToken && (
          <div style={{ marginTop: '1rem' }}>
            <p className="muted">
              No email provider is configured in this environment. Share this invite link with the invitee for testing:
            </p>
            <pre>{`${window.location.origin}/accept-invite?token=${inviteToken}`}</pre>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Team</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.user.email}</td>
                <td>
                  <select value={m.role} onChange={(e) => onRoleChange(m.id, e.target.value)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="muted">{new Date(m.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="danger" onClick={() => onRemove(m.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
