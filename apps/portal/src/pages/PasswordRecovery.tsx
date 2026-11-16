import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiRequestError } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ status: string; devResetToken?: string }>('/v1/auth/password/reset/request', { email });
      setSent(true);
      setDevToken(res.devResetToken ?? null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 400 }}>
        <h2>Reset your password</h2>
        {sent ? (
          <>
            <p>If an account exists for that email, a reset link has been sent.</p>
            {devToken && (
              <>
                <p className="muted">
                  No email provider is configured in this environment, so the reset token is shown here for testing:
                </p>
                <pre>{devToken}</pre>
                <Link to={`/reset-password?token=${devToken}`}>Continue to reset password</Link>
              </>
            )}
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div className="error-text">{error}</div>}
            <button type="submit">Send reset link</button>
          </form>
        )}
        <p className="muted" style={{ marginTop: '1rem' }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/v1/auth/password/reset/confirm', { token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to reset password.');
    }
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 400 }}>
        <h2>Set a new password</h2>
        {done ? (
          <p>Password updated. Redirecting to sign in...</p>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="token">Reset token</label>
            <input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {error && <div className="error-text">{error}</div>}
            <button type="submit">Update password</button>
          </form>
        )}
      </div>
    </div>
  );
}
