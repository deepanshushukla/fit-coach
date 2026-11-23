import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth, requirePlatformRole } from '../../middleware/auth';
import { recordAudit } from '../audit/audit';

export const plansRouter = Router();

async function toPlanSummary(plan: { id: string; code: string; name: string; billingPeriod: string }) {
  const planExercises = await prisma.planExercise.findMany({ where: { planId: plan.id } });
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    billingPeriod: plan.billingPeriod,
    // Explicit exercise IDs, never a bare count, so plan contents are deterministic and auditable (spec 6.5).
    exerciseIds: planExercises.map((pe) => pe.exerciseId),
  };
}

plansRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ where: { status: 'active' } });
    res.json(await Promise.all(plans.map(toPlanSummary)));
  })
);

plansRouter.get(
  '/:planId',
  asyncHandler(async (req, res) => {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.planId } });
    if (!plan) throw new ApiError('NOT_FOUND', 'Plan not found.');
    res.json(await toPlanSummary(plan));
  })
);

const createPlanSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_-]*$/, 'Plan code must be a lowercase slug.'),
  name: z.string().min(2),
  billingPeriod: z.enum(['monthly', 'annual', 'custom']).default('monthly'),
  exerciseIds: z.array(z.string()).default([]),
});

plansRouter.post(
  '/',
  requireAuth,
  requirePlatformRole('EXERCISE_ADMIN', 'SUPER_ADMIN'),
  validateBody(createPlanSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createPlanSchema>;
    const existing = await prisma.plan.findUnique({ where: { code: body.code } });
    if (existing) throw new ApiError('CONFLICT', `A plan with code '${body.code}' already exists.`);

    const plan = await prisma.plan.create({
      data: {
        code: body.code,
        name: body.name,
        billingPeriod: body.billingPeriod,
        planExercises: { create: body.exerciseIds.map((exerciseId) => ({ exerciseId })) },
      },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'plan.created',
      resourceType: 'plan',
      resourceId: plan.id,
      metadata: { code: plan.code, exerciseIds: body.exerciseIds },
    });

    res.status(201).json(await toPlanSummary(plan));
  })
);

const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['active', 'retired']).optional(),
  billingPeriod: z.enum(['monthly', 'annual', 'custom']).optional(),
  // When provided, replaces the plan's full exercise set (not a merge) — the same
  // "explicit, deterministic contents" rule as the summary response.
  exerciseIds: z.array(z.string()).optional(),
});

plansRouter.patch(
  '/:planId',
  requireAuth,
  requirePlatformRole('EXERCISE_ADMIN', 'SUPER_ADMIN'),
  validateBody(updatePlanSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updatePlanSchema>;
    const plan = await prisma.plan.findUnique({ where: { id: req.params.planId } });
    if (!plan) throw new ApiError('NOT_FOUND', 'Plan not found.');

    await prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: plan.id },
        data: { name: body.name, status: body.status, billingPeriod: body.billingPeriod },
      });
      if (body.exerciseIds) {
        await tx.planExercise.deleteMany({ where: { planId: plan.id } });
        await tx.planExercise.createMany({
          data: body.exerciseIds.map((exerciseId) => ({ planId: plan.id, exerciseId })),
        });
      }
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'plan.updated',
      resourceType: 'plan',
      resourceId: plan.id,
      metadata: { changes: body },
    });

    const updated = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    res.json(await toPlanSummary(updated));
  })
);
