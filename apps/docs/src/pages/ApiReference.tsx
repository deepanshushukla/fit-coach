interface Endpoint {
  method: string;
  path: string;
  auth: string;
  request?: string;
  response: string;
}

interface Resource {
  name: string;
  intro?: string;
  endpoints: Endpoint[];
}

const RESOURCES: Resource[] = [
  {
    name: 'Auth',
    endpoints: [
      { method: 'POST', path: '/v1/auth/signup', auth: 'Public', request: '{ email, password (min 10 chars) }', response: '201 { user: {id, email}, accessToken, refreshToken }' },
      { method: 'POST', path: '/v1/auth/login', auth: 'Public', request: '{ email, password }', response: '200 { user, accessToken, refreshToken }' },
      { method: 'POST', path: '/v1/auth/refresh', auth: 'Public', request: '{ refreshToken }', response: '200 { accessToken, refreshToken } (old refresh token rotated out)' },
      { method: 'POST', path: '/v1/auth/logout', auth: 'Public', request: '{ refreshToken }', response: '204' },
      { method: 'POST', path: '/v1/auth/password/reset/request', auth: 'Public', request: '{ email }', response: '200 { status: "sent" } (same response whether or not the account exists)' },
      { method: 'POST', path: '/v1/auth/password/reset/confirm', auth: 'Public', request: '{ token, newPassword }', response: '204 (revokes all existing sessions)' },
      { method: 'GET', path: '/v1/me', auth: 'Bearer access token', response: '{ id, email, platformRole }' },
    ],
  },
  {
    name: 'Organisations',
    endpoints: [
      { method: 'POST', path: '/v1/organisations', auth: 'Bearer', request: '{ name }', response: '201 Organisation (caller becomes OWNER)' },
      { method: 'GET', path: '/v1/organisations', auth: 'Bearer', response: 'Organisation[] the caller belongs to' },
      { method: 'GET', path: '/v1/organisations/:id', auth: 'Org member', response: 'Organisation + myRole' },
      { method: 'PATCH', path: '/v1/organisations/:id', auth: 'OWNER/ADMIN', request: '{ name? }', response: 'updated Organisation' },
      { method: 'GET', path: '/v1/organisations/:id/members', auth: 'Org member', response: 'Member[]' },
      { method: 'POST', path: '/v1/organisations/:id/invitations', auth: 'OWNER/ADMIN', request: '{ email, role }', response: '201 (no email provider — invite token returned directly, dev-only)' },
      { method: 'PATCH', path: '/v1/organisations/:id/members/:memberId', auth: 'OWNER/ADMIN', request: '{ role }', response: 'updated member' },
      { method: 'DELETE', path: '/v1/organisations/:id/members/:memberId', auth: 'OWNER/ADMIN', response: '204 (soft-removes)' },
      { method: 'GET', path: '/v1/organisations/:id/audit-logs', auth: 'OWNER/ADMIN', response: 'last 100 AuditLog rows' },
      { method: 'POST', path: '/v1/invitations/:token/accept', auth: 'Bearer', response: '{ organisationId, role }' },
    ],
  },
  {
    name: 'Applications & environments',
    endpoints: [
      { method: 'POST', path: '/v1/organisations/:orgId/applications', auth: 'OWNER/ADMIN/DEVELOPER', request: '{ name, platforms: [ios|android|react-native|expo|flutter] }', response: '201 Application' },
      { method: 'GET', path: '/v1/organisations/:orgId/applications', auth: 'Org member', response: 'Application[]' },
      { method: 'GET', path: '/v1/applications/:id', auth: 'App role', response: 'Application + environments' },
      { method: 'PATCH', path: '/v1/applications/:id', auth: 'OWNER/ADMIN', request: '{ name?, status? }', response: 'updated Application' },
      { method: 'GET', path: '/v1/organisations/:orgId/applications/:id/usage', auth: 'Org member', response: 'usage grouped by [exerciseId, eventType]' },
      { method: 'POST', path: '/v1/applications/:id/environments', auth: 'OWNER/ADMIN/DEVELOPER', request: '{ name: DEVELOPMENT|STAGING|PRODUCTION, allowedSdkVersions?, bundleIdentifiers? }', response: '201 Environment (server-generated public identifier, fc_env_...)' },
      { method: 'GET', path: '/v1/applications/:id/environments', auth: 'App role', response: 'Environment[]' },
      { method: 'PATCH', path: '/v1/environments/:id', auth: 'OWNER/ADMIN/DEVELOPER', request: '{ allowedSdkVersions?, bundleIdentifiers?, status? }', response: 'updated Environment' },
      { method: 'POST', path: '/v1/environments/:id/rotate-credential', auth: 'OWNER/ADMIN', response: 'Environment with a new public identifier' },
    ],
  },
  {
    name: 'Exercise catalogue',
    endpoints: [
      { method: 'GET', path: '/v1/exercises', auth: 'Public', response: 'published-only ExerciseSummary[] (no internal evaluator config/thresholds)' },
      { method: 'GET', path: '/v1/exercises/:id', auth: 'Public', response: 'ExerciseDetails (404 if draft)' },
      { method: 'POST', path: '/v1/exercises', auth: 'EXERCISE_ADMIN/SUPER_ADMIN', request: '{ id, name, currentVersion, evaluatorVersion, ... }', response: '201 Exercise, created as DRAFT' },
      { method: 'POST', path: '/v1/exercises/:id/publication-status', auth: 'EXERCISE_ADMIN/SUPER_ADMIN', request: '{ status: DRAFT|TESTING|PUBLISHED|DEPRECATED }', response: 'updated Exercise' },
    ],
  },
  {
    name: 'Plans',
    endpoints: [
      { method: 'GET', path: '/v1/plans', auth: 'Public', response: '{id, code, name, billingPeriod, exerciseIds}[] for active plans' },
      { method: 'GET', path: '/v1/plans/:id', auth: 'Public', response: 'same shape for one plan' },
      { method: 'POST', path: '/v1/plans', auth: 'EXERCISE_ADMIN/SUPER_ADMIN', request: '{ code, name, billingPeriod?, exerciseIds? }', response: '201 (409 if code exists)' },
      { method: 'PATCH', path: '/v1/plans/:id', auth: 'EXERCISE_ADMIN/SUPER_ADMIN', request: '{ name?, status?, billingPeriod?, exerciseIds? }', response: 'updated plan (exerciseIds replaces the full set, not a merge)' },
    ],
  },
  {
    name: 'Licences & entitlements',
    endpoints: [
      { method: 'POST', path: '/v1/organisations/:orgId/licences', auth: 'OWNER/ADMIN', request: '{ applicationId, planId, expiresAt, offlineGraceSeconds? }', response: '201 { licence, entitlementToken }' },
      { method: 'GET', path: '/v1/organisations/:orgId/licences', auth: 'Org member', response: 'Licence[]' },
      { method: 'GET', path: '/v1/licences/:id', auth: 'Licence role', response: 'Licence + exerciseOverrides + plan' },
      { method: 'PATCH', path: '/v1/licences/:id', auth: 'OWNER/ADMIN', request: '{ planId?, expiresAt?, offlineGraceSeconds? }', response: '{ licence, entitlementToken } (version bumps only on plan change)' },
      { method: 'POST', path: '/v1/licences/:id/revoke', auth: 'OWNER/ADMIN', response: 'updated Licence, status REVOKED' },
      { method: 'POST', path: '/v1/licences/:id/reissue-entitlement', auth: 'OWNER/ADMIN', response: '{ entitlementToken, claims } (always bumps version)' },
    ],
  },
  {
    name: 'SDK backend',
    intro: 'What packages/react-native’s SDK facade actually calls under the hood.',
    endpoints: [
      { method: 'POST', path: '/v1/sdk/bootstrap', auth: 'Public (keyed on the environment’s public identifier)', request: '{ environmentPublicIdentifier, sdkVersion, platform }', response: '{ sdkSessionToken, entitlementToken, claims }' },
      { method: 'POST', path: '/v1/sdk/entitlements/refresh', auth: 'SDK session token', request: '{ applicationId, environment, sdkVersion, platform }', response: '{ entitlementToken, claims }' },
      { method: 'POST', path: '/v1/sdk/usage/batch', auth: 'SDK session token', request: '{ events: [...] } (1–500 events)', response: '202 { accepted }' },
      { method: 'GET', path: '/v1/sdk/status', auth: 'SDK session token', response: '{ applicationId, environmentId, licenceStatus, entitlementVersion?, serverTime }' },
    ],
  },
  {
    name: 'Usage',
    endpoints: [
      { method: 'GET', path: '/v1/organisations/:orgId/usage', auth: 'Org member', response: 'usage grouped by [applicationId, environmentId, exerciseId, eventType]' },
    ],
  },
];

export function ApiReferencePage() {
  return (
    <div>
      <h1>API reference</h1>
      <p className="muted">
        Every route below is taken directly from the running API's routers — nothing here
        is aspirational. Base URL is wherever you run <code>apps/api</code> (e.g.{' '}
        <code>http://localhost:4000</code>). Error responses share one envelope:{' '}
        <code>{'{ error: { code, message, details?, requestId } }'}</code>. This page is
        hand-written from the source, not generated from an OpenAPI spec — a reasonable v2
        improvement once the surface stabilizes.
      </p>

      {RESOURCES.map((resource) => (
        <div className="card" key={resource.name}>
          <h3>{resource.name}</h3>
          {resource.intro && <p className="muted">{resource.intro}</p>}
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Auth</th>
                <th>Request</th>
                <th>Response</th>
              </tr>
            </thead>
            <tbody>
              {resource.endpoints.map((ep) => (
                <tr key={`${ep.method} ${ep.path}`}>
                  <td>
                    <span className="badge method">{ep.method}</span> <code>{ep.path}</code>
                  </td>
                  <td className="muted">{ep.auth}</td>
                  <td>{ep.request ? <code>{ep.request}</code> : <span className="muted">—</span>}</td>
                  <td className="muted">{ep.response}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
