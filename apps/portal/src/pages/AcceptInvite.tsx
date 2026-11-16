import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    try {
      await api.post(`/v1/invitations/${token}/accept`);
      setStatus('done');
      setTimeout(() => navigate('/org'), 1200);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiRequestError ? err.message : 'Unable to accept invitation.');
    }
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="card" style={{ width: 400 }}>
          <h2>Accept invitation</h2>
          <p>Sign in or create an account with the email address this invitation was sent to, then return to this link.</p>
          <button onClick={() => navigate(`/login`)}>Go to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 400 }}>
        <h2>Accept invitation</h2>
        {status === 'done' && <p>Joined. Redirecting...</p>}
        {status === 'error' && <div className="error-text">{message}</div>}
        {status === 'idle' && <button onClick={accept}>Accept invitation</button>}
      </div>
    </div>
  );
}
