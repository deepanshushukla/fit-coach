import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PoseFrame } from '@formcoach/types';
import type { ExerciseEvaluator, EvaluatorEvent, EvaluatorOutput } from '../evaluator';

const FIXTURES_DIR = join(__dirname, '..', '..', '..', '..', 'contracts', 'fixtures');

export function loadFixture(name: string): PoseFrame[] {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as PoseFrame[];
}

export interface ReplayResult {
  outputs: EvaluatorOutput[];
  events: EvaluatorEvent[];
  repCompletedEvents: Extract<EvaluatorEvent, { type: 'repCompleted' }>[];
  formIssueEvents: Extract<EvaluatorEvent, { type: 'formIssue' }>[];
}

export function replay(evaluator: ExerciseEvaluator, frames: PoseFrame[]): ReplayResult {
  const outputs: EvaluatorOutput[] = [];
  const events: EvaluatorEvent[] = [];
  for (const frame of frames) {
    const output = evaluator.update(frame);
    outputs.push(output);
    events.push(...output.events);
  }
  return {
    outputs,
    events,
    repCompletedEvents: events.filter((e): e is Extract<EvaluatorEvent, { type: 'repCompleted' }> => e.type === 'repCompleted'),
    formIssueEvents: events.filter((e): e is Extract<EvaluatorEvent, { type: 'formIssue' }> => e.type === 'formIssue'),
  };
}
