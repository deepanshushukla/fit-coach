import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/org');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 360 }}>
        <h2>Sign in to FormCoach</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="muted">
          No account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
