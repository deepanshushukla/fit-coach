import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../lib/env';
import {
  generateOpaqueToken,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from './tokens';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(10, 'Password must be at least 10 characters.'),
});

authRouter.post(
  '/signup',
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof signupSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError('CONFLICT', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const accessToken = signAccessToken({ sub: user.id, platformRole: user.platformRole });
    const refresh = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: new Date(Date.now() + env.refreshTokenTtlSeconds * 1000),
      },
    });

    res.status(201).json({
      user: { id: user.id, email: user.email },
      accessToken,
      refreshToken: refresh.token,
    });
  })
);

const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: z.string(),
});

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !passwordMatches || user.status !== 'ACTIVE') {
      throw new ApiError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    const accessToken = signAccessToken({ sub: user.id, platformRole: user.platformRole });
    const refresh = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.hash,
        expiresAt: new Date(Date.now() + env.refreshTokenTtlSeconds * 1000),
      },
    });

    res.json({ user: { id: user.id, email: user.email }, accessToken, refreshToken: refresh.token });
  })
);

const refreshSchema = z.object({ refreshToken: z.string() });

authRouter.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new ApiError('TOKEN_INVALID', 'Refresh token is invalid or expired.');
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError('TOKEN_INVALID', 'Refresh token is invalid or expired.');
    }

    // Rotate: revoke the used token and issue a new one, so a stolen token can only be replayed once.
    const next = generateRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: next.hash,
          expiresAt: new Date(Date.now() + env.refreshTokenTtlSeconds * 1000),
        },
      }),
    ]);

    const accessToken = signAccessToken({ sub: user.id, platformRole: user.platformRole });
    res.json({ accessToken, refreshToken: next.token });
  })
);

authRouter.post(
  '/logout',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.status(204).send();
  })
);

const resetRequestSchema = z.object({ email: z.string().email().transform((e) => e.toLowerCase().trim()) });

authRouter.post(
  '/password/reset/request',
  validateBody(resetRequestSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as z.infer<typeof resetRequestSchema>;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way whether or not the account exists, to avoid leaking account existence.
    if (user) {
      const { token, hash } = generateOpaqueToken();
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      // Reference implementation has no outbound email provider configured; the token is
      // returned directly in non-production environments only so the reset flow is testable end-to-end.
      if (process.env.NODE_ENV !== 'production') {
        res.json({ status: 'sent', devResetToken: token });
        return;
      }
    }
    res.json({ status: 'sent' });
  })
);

const resetConfirmSchema = z.object({ token: z.string(), newPassword: z.string().min(10) });

authRouter.post(
  '/password/reset/confirm',
  validateBody(resetConfirmSchema),
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body as z.infer<typeof resetConfirmSchema>;
    const tokenHash = hashToken(token);
    const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new ApiError('TOKEN_INVALID', 'Reset token is invalid or expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.status(204).send();
  })
);

export const meRouter = Router();
meRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new ApiError('NOT_FOUND', 'User not found.');
    res.json({ id: user.id, email: user.email, platformRole: user.platformRole });
  })
);
