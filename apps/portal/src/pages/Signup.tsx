import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiRequestError } from '../lib/api';

export function SignupPage() {
  const { signup } = useAuth();
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
      await signup(email, password);
      navigate('/org-setup');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="card" style={{ width: 360 }}>
        <h2>Create your FormCoach account</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="muted">At least 10 characters.</p>
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
