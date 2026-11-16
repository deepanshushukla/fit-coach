/**
 * Runnable end-to-end proof that @formcoach/react-native's facade works against a real
 * FormCoach API: bootstrap -> verify entitlement -> create a session -> run the
 * simulator-backed evaluator -> print live events -> stop -> print the summary.
 *
 * This intentionally does not import FormCoachCamera (that needs the real React Native
 * renderer); everything else — initialize(), createSession(), Session lifecycle and
 * events — is the exact same code path the RN app in src/App.tsx uses.
 *
 * Usage:
 *   FORMCOACH_ENV_ID=fc_env_xxxxx npm run demo:cli
 *
 * Get an environment's public identifier from the portal: Applications -> your app ->
 * Environments. The licence assigned to that application determines which exercises
 * are included (locked exercises fail session creation with EXERCISE_NOT_LICENSED).
 */
// Imports the specific module rather than the package barrel so this Node-runnable
// demo never pulls in FormCoachCamera.tsx, which imports 'react-native' — a module
// that only runs under the Metro bundler / RN runtime, not plain Node.
import { FormCoachClient } from '@formcoach/react-native/dist/formCoach';

const API_BASE_URL = process.env.FORMCOACH_API_URL ?? 'http://localhost:4000';
const ENVIRONMENT_PUBLIC_IDENTIFIER = process.env.FORMCOACH_ENV_ID;
const EXERCISE_ID = process.env.FORMCOACH_EXERCISE ?? 'squat';
const RUN_MS = Number(process.env.FORMCOACH_DEMO_DURATION_MS ?? 8000);

async function main() {
  if (!ENVIRONMENT_PUBLIC_IDENTIFIER) {
    console.error(
      'Missing FORMCOACH_ENV_ID. Create an application + environment + licence in the portal, ' +
        'then run:\n  FORMCOACH_ENV_ID=fc_env_xxxxx npm run demo:cli'
    );
    process.exit(1);
  }

  const client = new FormCoachClient({ apiBaseUrl: API_BASE_URL });

  console.log(`Initializing against ${API_BASE_URL} as environment ${ENVIRONMENT_PUBLIC_IDENTIFIER}...`);
  await client.initialize({ appId: ENVIRONMENT_PUBLIC_IDENTIFIER, environment: 'production' });
  console.log('Initialized.');

  const exercises = await client.getExercises();
  console.log('Catalogue:', exercises);

  const session = await client.createSession({
    exercise: EXERCISE_ID,
    camera: { facing: 'back' },
    subject: { requiredView: 'side' },
    feedback: { visual: true, voice: false, haptic: false },
  });
  console.log(`Session created: ${session.sessionId}`);

  session.on('trackingUpdate', (e) => console.log(`[trackingUpdate] ${e.status}`));
  session.on('phaseChanged', (e) => console.log(`[phaseChanged] ${e.fromPhase} -> ${e.toPhase}`));
  session.on('repCompleted', (e) => console.log(`[repCompleted] rep #${e.repCount} (${e.quality})`));
  session.on('formIssue', (e) => console.log(`[formIssue] ${e.issueId}: ${e.message}`));
  session.on('calibrationRequired', (e) => console.log(`[calibrationRequired] ${e.guidance}`));
  session.on('calibrationCompleted', () => console.log('[calibrationCompleted]'));

  await session.start();
  console.log(`Running for ${RUN_MS}ms...`);
  await new Promise((resolve) => setTimeout(resolve, RUN_MS));

  const summary = await session.stop();
  await session.dispose();

  console.log('\nSession summary:', summary);
}

main().catch((err) => {
  console.error('Demo failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
