import type { BodyView } from '@formcoach/types';
import type { ExerciseEvaluator } from './evaluator';
import { SquatEvaluator } from './exercises/squat';
import { SquatFrontViewEvaluator } from './exercises/squat-front';
import { PushUpEvaluator } from './exercises/push-up';
import { LungeEvaluator } from './exercises/lunge';

const factories: Record<string, Partial<Record<BodyView, () => ExerciseEvaluator>>> = {
  squat: { side: () => new SquatEvaluator(), front: () => new SquatFrontViewEvaluator() },
  push_up: { side: () => new PushUpEvaluator() },
  lunge: { side: () => new LungeEvaluator() },
};

/** `requiredView` defaults to 'side' — every existing caller that omits it keeps today's exact behavior. */
export function createEvaluator(exerciseId: string, requiredView: BodyView = 'side'): ExerciseEvaluator | undefined {
  const factory = factories[exerciseId]?.[requiredView];
  return factory ? factory() : undefined;
}

export function supportedExerciseIds(): string[] {
  return Object.keys(factories);
}

export function supportedViews(exerciseId: string): BodyView[] {
  return Object.keys(factories[exerciseId] ?? {}) as BodyView[];
}
