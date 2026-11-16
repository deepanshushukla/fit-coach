import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface TestServerHandle {
  url: string;
  close: () => Promise<void>;
}

export type RouteHandler = (req: http.IncomingMessage, body: unknown) => { status: number; body?: unknown };

export function startTestServer(routes: Record<string, RouteHandler>): Promise<TestServerHandle> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const key = `${req.method} ${req.url}`;
      const handler = routes[key];
      if (!handler) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'no route' } }));
        return;
      }
      let parsedBody: unknown;
      try {
        parsedBody = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf-8')) : undefined;
      } catch {
        parsedBody = undefined;
      }
      const { status, body } = handler(req, parsedBody);
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(body === undefined ? '' : JSON.stringify(body));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

/** Builds an unsigned (header.payload.signature) token with the given claims — enough for decode-only tests. */
export function fakeEntitlementToken(claims: Record<string, unknown>): string {
  const base64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = base64url({ alg: 'RS256', typ: 'JWT', kid: 'test-key' });
  const payload = base64url(claims);
  return `${header}.${payload}.fake-signature`;
}
