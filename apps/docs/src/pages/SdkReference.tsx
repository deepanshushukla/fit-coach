export function SdkReferencePage() {
  return (
    <div>
      <h1>SDK reference</h1>
      <p className="muted">
        <code>@formcoach/react-native</code> is the only SDK package with real logic
        behind it today. Expo, web, and Flutter packages are placeholders (see{' '}
        <a href="/">home</a>). Everything below is the facade's actual exported surface —
        <code>packages/react-native/src/index.ts</code>.
      </p>

      <div className="card">
        <h3>Quick integration</h3>
        <pre>{`import { FormCoach } from '@formcoach/react-native';

await FormCoach.initialize({
  appId: '<your environment public identifier>',
  environment: 'production',
});

const session = await FormCoach.createSession({
  exercise: 'squat',
  camera: { facing: 'front' },
  subject: { requiredView: 'side' },
  feedback: { visual: true, voice: false, haptic: false },
});

session.on('repCompleted', (e) => console.log('rep', e.repCount, e.quality));
session.on('formIssue', (e) => console.log(e.severity, e.message));

await session.start();`}</pre>
        <p className="muted">
          Use the public identifier shown on an environment's Applications page in the
          portal as <code>appId</code>. It is not a secret and is safe to embed in a
          mobile binary.
        </p>
      </div>

      <div className="card">
        <h3>FormCoach / FormCoachClient</h3>
        <table>
          <thead>
            <tr><th>Member</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><code>FormCoach</code></td><td>Singleton instance of <code>FormCoachClient</code> — use this unless you need multiple independent clients.</td></tr>
            <tr><td><code>new FormCoachClient(options?)</code></td><td><code>{'{ storage?, apiBaseUrl?, nativeBridge? }'}</code> — defaults to in-memory storage and the bundled simulator bridge.</td></tr>
            <tr><td><code>initialize(config)</code></td><td>Calls <code>POST /v1/sdk/bootstrap</code>, caches the returned entitlement. Falls back to a cached entitlement within its offline-grace window if the network call fails.</td></tr>
            <tr><td><code>getExercises()</code></td><td>Fetches the public catalogue and marks each exercise <code>included</code>/<code>locked</code> against your cached entitlement.</td></tr>
            <tr><td><code>getExerciseDetails(exerciseId)</code></td><td>Same, for one exercise.</td></tr>
            <tr><td><code>createSession(config)</code></td><td>Validates the entitlement covers the requested exercise and isn't expired, then starts a <code>Session</code>.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Session</h3>
        <table>
          <thead>
            <tr><th>Member</th><th>What it does</th></tr>
          </thead>
          <tbody>
            <tr><td><code>on(eventName, handler)</code></td><td>Subscribes; returns an unsubscribe function.</td></tr>
            <tr><td><code>start() / pause() / resume() / stop()</code></td><td>Lifecycle transitions — invalid transitions throw <code>SESSION_INVALID_STATE</code>.</td></tr>
            <tr><td><code>dispose()</code></td><td>Idempotent; clears all handlers.</td></tr>
            <tr><td><code>getStatus()</code></td><td>Current <code>TrackingStatus</code>.</td></tr>
            <tr><td><code>getMetrics()</code></td><td><code>{'{ repCount, currentPhase }'}</code>.</td></tr>
          </tbody>
        </table>
        <p className="muted">
          Events: <code>ready</code>, <code>trackingUpdate</code>, <code>trackingLost</code>,{' '}
          <code>calibrationRequired</code>, <code>calibrationCompleted</code>,{' '}
          <code>phaseChanged</code>, <code>repCompleted</code>, <code>formIssue</code>,{' '}
          <code>feedback</code>, <code>performance</code>, <code>sessionCompleted</code>,{' '}
          <code>error</code> — exact payload shapes are in <code>@formcoach/types</code>.
        </p>
      </div>

      <div className="card">
        <h3>What's simulated vs. real underneath</h3>
        <ul>
          <li>
            <code>FormCoachCamera</code> is a placeholder component — it renders a status
            box, not a camera preview with a skeleton overlay. A real build would render a
            native CameraX/AVFoundation preview.
          </li>
          <li>
            The only working <code>NativeBridge</code> implementation is{' '}
            <code>SimulatorNativeBridge</code>, which drives the real{' '}
            <code>@formcoach/core</code> evaluators against synthetic pose data on a
            timer — it is not reading a camera. Real native engines now exist (Kotlin for
            Android, Swift for iOS — see the home page's status table) but aren't wired
            into this SDK's bridge yet; today they only run inside the standalone{' '}
            <code>apps/demo-android</code> / <code>apps/demo-ios</code> apps.
          </li>
          <li>
            Entitlement handling in this facade is decode-only, not
            signature-verified — cryptographic verification against an embedded public
            key is a native-layer responsibility.
          </li>
          <li>
            <code>MemoryStorage</code> (the default <code>Storage</code>) does not
            persist across app restarts. Inject your own (e.g. AsyncStorage-backed)
            implementation for production use.
          </li>
        </ul>
      </div>
    </div>
  );
}
