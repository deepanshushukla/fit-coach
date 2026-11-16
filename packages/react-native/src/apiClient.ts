export interface BootstrapResponse {
  sdkSessionToken: string;
  entitlementToken: string;
}

export interface RefreshResponse {
  entitlementToken: string;
}

export class FormCoachApiClient {
  constructor(private readonly baseUrl: string) {}

  async bootstrap(input: { environmentPublicIdentifier: string; sdkVersion: string; platform: string }): Promise<BootstrapResponse> {
    return this.post('/v1/sdk/bootstrap', input);
  }

  async refreshEntitlement(
    sdkSessionToken: string,
    input: { applicationId: string; environment: string; sdkVersion: string; platform: string }
  ): Promise<RefreshResponse> {
    return this.post('/v1/sdk/entitlements/refresh', input, sdkSessionToken);
  }

  async sendUsageBatch(
    sdkSessionToken: string,
    events: Array<Record<string, unknown>>
  ): Promise<void> {
    await this.post('/v1/sdk/usage/batch', { events }, sdkSessionToken);
  }

  private async post<T>(path: string, body: unknown, bearerToken?: string): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error?.message ?? `FormCoach API request to ${path} failed with status ${response.status}`);
    }

    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }
}
