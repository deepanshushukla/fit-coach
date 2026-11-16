import type { ExerciseEvaluator } from './evaluator';
import { SquatEvaluator } from './exercises/squat';
import { PushUpEvaluator } from './exercises/push-up';
import { LungeEvaluator } from './exercises/lunge';

const factories: Record<string, () => ExerciseEvaluator> = {
  squat: () => new SquatEvaluator(),
  push_up: () => new PushUpEvaluator(),
  lunge: () => new LungeEvaluator(),
};

export function createEvaluator(exerciseId: string): ExerciseEvaluator | undefined {
  const factory = factories[exerciseId];
  return factory ? factory() : undefined;
}

export function supportedExerciseIds(): string[] {
  return Object.keys(factories);
}
