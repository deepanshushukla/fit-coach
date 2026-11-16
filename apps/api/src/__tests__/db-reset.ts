import './env-setup';
import { prisma } from '../lib/prisma';

const TABLES = [
  'AuditLog',
  'UsageEvent',
  'EntitlementIssue',
  'LicenceExerciseOverride',
  'Licence',
  'ExerciseVersion',
  'PlanExercise',
  'Exercise',
  'Plan',
  'ApplicationEnvironment',
  'Application',
  'Invitation',
  'OrganisationMember',
  'Organisation',
  'PasswordResetToken',
  'RefreshToken',
  'SigningKey',
  'User',
];

export async function resetDatabase(): Promise<void> {
  const quoted = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}
