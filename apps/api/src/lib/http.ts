import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async Express handler so rejected promises reach the error middleware. */
export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function requestId(req: Request): string {
  const header = req.header('x-request-id');
  return header && header.length > 0 ? header : (req as Request & { generatedRequestId?: string }).generatedRequestId ?? '';
}
