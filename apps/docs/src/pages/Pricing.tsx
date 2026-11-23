import { useEffect, useState } from 'react';
import { getJson } from '../lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  billingPeriod: string;
  exerciseIds: string[];
}

export function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<Plan[]>('/v1/plans')
      .then(setPlans)
      .catch(() => setError('Could not reach the FormCoach API — is apps/api running?'));
  }, []);

  return (
    <div>
      <h1>Pricing</h1>
      <p className="muted">
        Plans below are fetched live from <code>GET /v1/plans</code> — what you see is
        whatever the backend is actually configured with, not hardcoded marketing copy.
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="row">
        {plans.map((plan) => (
          <div className="card" key={plan.id}>
            <h3>{plan.name}</h3>
            <p className="muted">Billed {plan.billingPeriod}</p>
            <p>
              <strong>Contact us</strong> for pricing.
            </p>
            <p className="muted">Includes:</p>
            <ul>
              {plan.exerciseIds.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
            <a className="button secondary" href="mailto:sales@formcoach.example">
              Contact sales
            </a>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Why there are no numbers here</h3>
        <p className="muted">
          Plan records in the backend don't have price or currency fields yet, and no
          billing provider (Stripe, etc.) is wired up — this is a genuinely open decision,
          not an oversight. Plans today describe which exercises are included and a
          billing period (monthly/annual/custom), nothing more. Reach out and we'll figure
          out pricing directly until that's built.
        </p>
      </div>
    </div>
  );
}
