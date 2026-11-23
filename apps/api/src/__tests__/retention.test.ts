import './env-setup';
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabase } from './db-reset';
import { prisma } from '../lib/prisma';
import { sweepUsageEvents, sweepAuditLogs } from '../modules/usage/retention';

before(async () => {
  await resetDatabase();
});
beforeEach(async () => {
  await resetDatabase();
});

async function seedAppEnvironment() {
  const organisation = await prisma.organisation.create({ data: { name: 'Org', slug: `org-${Date.now()}` } });
  const application = await prisma.application.create({
    data: { organisationId: organisation.id, name: 'App', platforms: ['react-native'] },
  });
  const environment = await prisma.applicationEnvironment.create({
    data: { applicationId: application.id, name: 'PRODUCTION', publicIdentifier: `env_${Date.now()}` },
  });
  return { organisation, application, environment };
}

test('sweepUsageEvents with no retentionDays configured deletes nothing', async () => {
  const { organisation, application, environment } = await seedAppEnvironment();
  await prisma.usageEvent.create({
    data: {
      organisationId: organisation.id,
      applicationId: application.id,
      environmentId: environment.id,
      eventType: 'session_started',
      sdkVersion: '1.0.0',
      platform: 'react-native',
      eventTimestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
    },
  });

  const result = await sweepUsageEvents();
  assert.equal(result.deletedCount, 0);
  assert.equal(await prisma.usageEvent.count(), 1);
});

test('sweepUsageEvents deletes rows older than retentionDays but keeps recent ones', async () => {
  const { organisation, application, environment } = await seedAppEnvironment();
  const now = new Date('2026-01-01T00:00:00Z');

  await prisma.usageEvent.createMany({
    data: [
      {
        organisationId: organisation.id,
        applicationId: application.id,
        environmentId: environment.id,
        eventType: 'session_started',
        sdkVersion: '1.0.0',
        platform: 'react-native',
        eventTimestamp: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000), // old
      },
      {
        organisationId: organisation.id,
        applicationId: application.id,
        environmentId: environment.id,
        eventType: 'session_started',
        sdkVersion: '1.0.0',
        platform: 'react-native',
        eventTimestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // recent
      },
    ],
  });

  const result = await sweepUsageEvents({ retentionDays: 365, now });
  assert.equal(result.deletedCount, 1);

  const remaining = await prisma.usageEvent.findMany();
  assert.equal(remaining.length, 1);
  assert.ok(remaining[0].eventTimestamp.getTime() > now.getTime() - 365 * 24 * 60 * 60 * 1000);
});

test('sweepAuditLogs deletes rows older than retentionDays but keeps recent ones', async () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const old = await prisma.auditLog.create({
    data: { action: 'test.old', resourceType: 'test', resourceId: 'old', createdAt: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000) },
  });
  const recent = await prisma.auditLog.create({
    data: { action: 'test.recent', resourceType: 'test', resourceId: 'recent', createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
  });

  const result = await sweepAuditLogs({ retentionDays: 365, now });
  assert.equal(result.deletedCount, 1);

  const remaining = await prisma.auditLog.findMany();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, recent.id);
  assert.equal(await prisma.auditLog.findUnique({ where: { id: old.id } }), null);
});
