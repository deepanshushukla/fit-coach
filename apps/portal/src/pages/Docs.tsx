export function DocsPage() {
  return (
    <div>
      <h2>SDK & documentation</h2>
      <div className="card">
        <h3>Supported SDKs</h3>
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Package</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>React Native</td>
              <td><code>@formcoach/react-native</code></td>
              <td><span className="badge success">Available</span></td>
            </tr>
            <tr>
              <td>Expo</td>
              <td><code>@formcoach/expo</code></td>
              <td><span className="badge">Config plugin scaffolded</span></td>
            </tr>
            <tr>
              <td>Android (native)</td>
              <td><code>com.formcoach:formcoach-android</code></td>
              <td><span className="badge">Interface defined, not implemented</span></td>
            </tr>
            <tr>
              <td>iOS (native)</td>
              <td><code>FormCoachSDK</code></td>
              <td><span className="badge">Interface defined, not implemented</span></td>
            </tr>
            <tr>
              <td>Flutter</td>
              <td><code>formcoach_flutter</code></td>
              <td><span className="badge">Interface defined, not implemented</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Quick integration</h3>
        <pre>{`import { FormCoach } from '@formcoach/react-native';

await FormCoach.initialize({
  appId: '<your environment public identifier>',
  environment: 'production',
});

const session = await FormCoach.createSession({ exercise: 'squat' });
await session.start();`}</pre>
        <p className="muted">
          Use the public identifier shown on an environment's Applications page as <code>appId</code>. It is not a
          secret and is safe to embed in a mobile binary.
        </p>
      </div>
    </div>
  );
}
