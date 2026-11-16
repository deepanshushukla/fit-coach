import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  billingPeriod: string;
  exerciseIds: string[];
}

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api.get<Plan[]>('/v1/plans').then(setPlans);
  }, []);

  return (
    <div>
      <h2>Plans</h2>
      <p className="muted">Plan contents are explicit exercise IDs, never a bare count, so entitlements stay deterministic and auditable.</p>
      {plans.map((plan) => (
        <div className="card" key={plan.id}>
          <div className="topbar">
            <h3 style={{ margin: 0 }}>{plan.name}</h3>
            <span className="badge">{plan.billingPeriod}</span>
          </div>
          <p className="muted">Code: <code>{plan.code}</code></p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {plan.exerciseIds.map((id) => (
              <span key={id} className="badge" style={{ flex: 'unset' }}>
                {id}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
