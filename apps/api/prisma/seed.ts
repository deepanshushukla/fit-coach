import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const squat = await prisma.exercise.upsert({
    where: { id: 'squat' },
    update: {},
    create: {
      id: 'squat',
      name: 'Squat',
      description: 'Lower-body movement with a depth-based repetition cycle.',
      instructions: 'Stand side-on to the camera with your full body in frame.',
      publicationStatus: 'PUBLISHED',
      currentVersion: '1.0.0',
      supportedPlatforms: ['ios', 'android', 'react-native', 'expo'],
      supportedViews: ['side'],
      evaluatorVersion: '1.0.0',
      limitations: ['Requires a side camera view', 'Depth and back-rounding cues only; no knee-valgus check yet'],
      setupGuidance: 'Position your phone so your entire body is visible from the side.',
    },
  });

  const pushUp = await prisma.exercise.upsert({
    where: { id: 'push_up' },
    update: {},
    create: {
      id: 'push_up',
      name: 'Push-up',
      description: 'Horizontal pressing movement tracked for elbow angle and hip alignment.',
      instructions: 'Position the camera to your side at ground level.',
      publicationStatus: 'PUBLISHED',
      currentVersion: '1.0.0',
      supportedPlatforms: ['ios', 'android', 'react-native', 'expo'],
      supportedViews: ['side'],
      evaluatorVersion: '1.0.0',
      limitations: ['Requires a side camera view near ground level'],
      setupGuidance: 'Place your phone on the floor to your side.',
    },
  });

  const lunge = await prisma.exercise.upsert({
    where: { id: 'lunge' },
    update: {},
    create: {
      id: 'lunge',
      name: 'Lunge',
      description: 'Single-leg lower-body movement tracked from a side view.',
      instructions: 'Stand side-on to the camera; alternate-leg lunges are tracked as a single leg per session.',
      publicationStatus: 'TESTING',
      currentVersion: '1.0.0',
      supportedPlatforms: ['ios', 'android', 'react-native', 'expo'],
      supportedViews: ['side'],
      evaluatorVersion: '1.0.0',
      limitations: [
        'Side view only; front-view rules not yet implemented',
        'Alternating-leg lunges should be run as separate sessions until per-leg switching is validated',
      ],
      setupGuidance: 'Position your phone so your working leg is visible from the side.',
    },
  });

  const communityPlan = await prisma.plan.upsert({
    where: { code: 'community' },
    update: {},
    create: { code: 'community', name: 'Community', billingPeriod: 'monthly' },
  });

  const proPlan = await prisma.plan.upsert({
    where: { code: 'pro' },
    update: {},
    create: { code: 'pro', name: 'Pro', billingPeriod: 'monthly' },
  });

  await prisma.planExercise.upsert({
    where: { planId_exerciseId: { planId: communityPlan.id, exerciseId: squat.id } },
    update: {},
    create: { planId: communityPlan.id, exerciseId: squat.id },
  });
  await prisma.planExercise.upsert({
    where: { planId_exerciseId: { planId: communityPlan.id, exerciseId: pushUp.id } },
    update: {},
    create: { planId: communityPlan.id, exerciseId: pushUp.id },
  });

  for (const exercise of [squat, pushUp, lunge]) {
    await prisma.planExercise.upsert({
      where: { planId_exerciseId: { planId: proPlan.id, exerciseId: exercise.id } },
      update: {},
      create: { planId: proPlan.id, exerciseId: exercise.id },
    });
  }

  console.log('Seed complete:', { exercises: [squat.id, pushUp.id, lunge.id], plans: [communityPlan.code, proPlan.code] });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
