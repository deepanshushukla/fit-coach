import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';

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
