export function HomePage() {
  return (
    <div>
      <div className="hero">
        <h1>Form-check intelligence for fitness apps</h1>
        <p>
          FormCoach is an SDK and licensing backend for real-time exercise form feedback —
          rep counting, phase tracking, and form-issue detection, licensed per exercise
          through signed entitlements your app can verify offline.
        </p>
        <div className="cta-row">
          <a className="button" href="/pricing">
            See plans
          </a>
          <a className="button secondary" href="/sdk">
            Read the SDK docs
          </a>
        </div>
      </div>

      <div className="card">
        <h3>How it works</h3>
        <ol>
          <li>
            Your app calls <code>FormCoach.initialize()</code> with your environment's
            public identifier. The backend resolves the licence assigned to your
            application (or your organisation, if no app-specific licence exists),
            computes the exercise set that licence grants, and signs it as an
            entitlement — an RS256 JWT with an expiry and an offline-grace window.
          </li>
          <li>
            <code>FormCoach.getExercises()</code> returns the public catalogue with each
            exercise marked <code>included</code> or <code>locked</code> against your
            entitlement.
          </li>
          <li>
            <code>FormCoach.createSession({'{'} exercise {'}'})</code> starts a session for
            a licensed exercise and streams typed events —{' '}
            <code>phaseChanged</code>, <code>repCompleted</code>, <code>formIssue</code>,
            and more — as the user moves.
          </li>
        </ol>
        <p className="muted">
          Full method signatures and event payloads are on the <a href="/sdk">SDK page</a>;
          every route the SDK and the management portal call is on the{' '}
          <a href="/api">API reference</a>.
        </p>
      </div>

      <div className="card">
        <h3>What's actually real here</h3>
        <p className="muted">
          This is a product build log, not marketing copy — we'd rather you know exactly
          what's shipped before you integrate against it.
        </p>
        <table>
          <thead>
            <tr>
              <th>Layer</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>REST API (auth, orgs, licensing, signed entitlements, usage)</td>
              <td>
                <span className="badge success">Real</span> — Postgres-backed, with an
                integration test suite covering auth, licensing, signing, plans, and
                retention.
              </td>
            </tr>
            <tr>
              <td>Entitlement signing</td>
              <td>
                <span className="badge success">Real</span> — RS256, with a KMS-backed
                production option and a documented dev-only local-key fallback. See the{' '}
                <a href="/api">API reference</a>.
              </td>
            </tr>
            <tr>
              <td>React Native SDK facade</td>
              <td>
                <span className="badge success">Real</span> — session lifecycle,
                entitlement caching, offline-first fallback are real logic, with tests.
                The camera/pose layer it drives is a documented simulator unless a native
                bridge is wired in (see below).
              </td>
            </tr>
            <tr>
              <td>Native Android / iOS pose pipeline</td>
              <td>
                <span className="badge success">Real, launch-verified</span> — camera →
                MediaPipe pose inference → a hand-ported squat evaluator, running on a
                real emulator (Android) and simulator (iOS) without crashing.{' '}
                <strong>Not yet verified against a real human</strong> — no emulator or
                simulator has a usable camera feed; squat is the only exercise ported so
                far, side view only.
              </td>
            </tr>
            <tr>
              <td>Push-up / lunge on native, Expo, web, Flutter SDKs</td>
              <td>
                <span className="badge">Not built</span> — deliberately deferred.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
