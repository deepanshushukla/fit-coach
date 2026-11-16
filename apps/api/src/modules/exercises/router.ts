import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth, requirePlatformRole } from '../../middleware/auth';
import { recordAudit } from '../audit/audit';

export const exercisesRouter = Router();

function toPublicCatalogueEntry(exercise: {
  id: string;
  name: string;
  description: string;
  instructions: string;
  publicationStatus: string;
  currentVersion: string;
  supportedPlatforms: string[];
  supportedViews: string[];
  evaluatorVersion: string;
  limitations: string[];
  setupGuidance: string;
}) {
  // Deliberately omits evaluator configuration/internal thresholds: the public catalogue
  // must not expose internal evaluator source (spec 6.4).
  return {
    id: exercise.id,
    name: exercise.name,
    description: exercise.description,
    instructions: exercise.instructions,
    publicationStatus: exercise.publicationStatus,
    currentVersion: exercise.currentVersion,
    supportedPlatforms: exercise.supportedPlatforms,
    supportedViews: exercise.supportedViews,
    evaluatorVersion: exercise.evaluatorVersion,
    limitations: exercise.limitations,
    setupGuidance: exercise.setupGuidance,
  };
}

exercisesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const exercises = await prisma.exercise.findMany({ where: { publicationStatus: 'PUBLISHED' } });
    res.json(exercises.map(toPublicCatalogueEntry));
  })
);

exercisesRouter.get(
  '/:exerciseId',
  asyncHandler(async (req, res) => {
    const exercise = await prisma.exercise.findUnique({ where: { id: req.params.exerciseId } });
    if (!exercise || exercise.publicationStatus === 'DRAFT') {
      throw new ApiError('EXERCISE_NOT_FOUND', 'Exercise not found.');
    }
    res.json(toPublicCatalogueEntry(exercise));
  })
);

const createExerciseSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Exercise id must be a lowercase snake_case slug.'),
  name: z.string().min(2),
  description: z.string().default(''),
  instructions: z.string().default(''),
  currentVersion: z.string(),
  supportedPlatforms: z.array(z.string()).default([]),
  supportedViews: z.array(z.enum(['front', 'side', 'back'])).default([]),
  evaluatorVersion: z.string(),
  limitations: z.array(z.string()).default([]),
  setupGuidance: z.string().default(''),
});

exercisesRouter.post(
  '/',
  requireAuth,
  requirePlatformRole('EXERCISE_ADMIN', 'SUPER_ADMIN'),
  validateBody(createExerciseSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createExerciseSchema>;
    const exercise = await prisma.exercise.create({ data: { ...body, publicationStatus: 'DRAFT' } });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'exercise.created',
      resourceType: 'exercise',
      resourceId: exercise.id,
    });
    res.status(201).json(exercise);
  })
);

const publishSchema = z.object({
  status: z.enum(['DRAFT', 'TESTING', 'PUBLISHED', 'DEPRECATED']),
});

exercisesRouter.post(
  '/:exerciseId/publication-status',
  requireAuth,
  requirePlatformRole('EXERCISE_ADMIN', 'SUPER_ADMIN'),
  validateBody(publishSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof publishSchema>;
    const exercise = await prisma.exercise.findUnique({ where: { id: req.params.exerciseId } });
    if (!exercise) throw new ApiError('EXERCISE_NOT_FOUND', 'Exercise not found.');

    const updated = await prisma.exercise.update({
      where: { id: exercise.id },
      data: { publicationStatus: status },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'exercise.publication_status_changed',
      resourceType: 'exercise',
      resourceId: exercise.id,
      metadata: { fromStatus: exercise.publicationStatus, toStatus: status },
    });

    res.json(updated);
  })
);
