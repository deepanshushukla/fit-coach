import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { ApiError } from './lib/errors';
import { authRouter, meRouter } from './modules/auth/router';
import { invitationsRouter, organisationsRouter } from './modules/organisations/router';
import { applicationsRouter, environmentsRouter, organisationApplicationsRouter } from './modules/applications/router';
import { exercisesRouter } from './modules/exercises/router';
import { plansRouter } from './modules/plans/router';
import { licencesRouter, organisationLicencesRouter } from './modules/licences/router';
import { sdkRouter } from './modules/sdk/router';
import { organisationUsageRouter } from './modules/usage/router';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
    (req as Request & { generatedRequestId: string }).generatedRequestId = id;
    res.setHeader('x-request-id', id);
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  app.use('/v1/auth', authRouter);
  app.use('/v1/me', meRouter);
  app.use('/v1/invitations', invitationsRouter);
  app.use('/v1/organisations', organisationsRouter);
  app.use('/v1/organisations/:organisationId/applications', organisationApplicationsRouter);
  app.use('/v1/organisations/:organisationId/licences', organisationLicencesRouter);
  app.use('/v1/organisations/:organisationId/usage', organisationUsageRouter);
  app.use('/v1/applications', applicationsRouter);
  app.use('/v1/environments', environmentsRouter);
  app.use('/v1/exercises', exercisesRouter);
  app.use('/v1/plans', plansRouter);
  app.use('/v1/licences', licencesRouter);
  app.use('/v1/sdk', sdkRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const requestId = (req as Request & { generatedRequestId?: string }).generatedRequestId;
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details, requestId } });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', requestId } });
  };
  app.use(errorHandler);

  return app;
}
