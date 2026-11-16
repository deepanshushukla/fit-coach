import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { validateBody } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireOrgRole } from '../../middleware/orgRbac';
import { slugify } from '../../lib/slug';
import { generateOpaqueToken, hashToken } from '../auth/tokens';
import { recordAudit } from '../audit/audit';

export const organisationsRouter = Router();
organisationsRouter.use(requireAuth);

const createOrgSchema = z.object({ name: z.string().min(2).max(120) });

organisationsRouter.post(
  '/',
  validateBody(createOrgSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as z.infer<typeof createOrgSchema>;
    const organisation = await prisma.organisation.create({
      data: {
        name,
        slug: slugify(name),
        members: { create: { userId: req.user!.id, role: 'OWNER' } },
      },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: organisation.id,
      action: 'organisation.created',
      resourceType: 'organisation',
      resourceId: organisation.id,
    });
    res.status(201).json(organisation);
  })
);

organisationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.organisationMember.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
      include: { organisation: true },
    });
    res.json(memberships.map((m) => ({ ...m.organisation, myRole: m.role })));
  })
);

organisationsRouter.get(
  '/:organisationId',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const organisation = await prisma.organisation.findUnique({ where: { id: req.params.organisationId } });
    if (!organisation) throw new ApiError('NOT_FOUND', 'Organisation not found.');
    res.json({ ...organisation, myRole: req.orgRole });
  })
);

const patchOrgSchema = z.object({ name: z.string().min(2).max(120).optional() });

organisationsRouter.patch(
  '/:organisationId',
  requireOrgRole('OWNER', 'ADMIN'),
  validateBody(patchOrgSchema),
  asyncHandler(async (req, res) => {
    const organisation = await prisma.organisation.update({
      where: { id: req.params.organisationId },
      data: req.body as z.infer<typeof patchOrgSchema>,
    });
    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: organisation.id,
      action: 'organisation.updated',
      resourceType: 'organisation',
      resourceId: organisation.id,
      metadata: req.body as Record<string, unknown>,
    });
    res.json(organisation);
  })
);

organisationsRouter.get(
  '/:organisationId/members',
  requireOrgRole(),
  asyncHandler(async (req, res) => {
    const members = await prisma.organisationMember.findMany({
      where: { organisationId: req.params.organisationId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true } } },
    });
    res.json(members.map((m) => ({ id: m.id, role: m.role, user: m.user, createdAt: m.createdAt })));
  })
);

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'ANALYST']),
});

organisationsRouter.post(
  '/:organisationId/invitations',
  requireOrgRole('OWNER', 'ADMIN'),
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const { email, role } = req.body as z.infer<typeof inviteSchema>;
    const { token, hash } = generateOpaqueToken();

    const invitation = await prisma.invitation.create({
      data: {
        organisationId: req.params.organisationId,
        email,
        role,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByUserId: req.user!.id,
      },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.params.organisationId,
      action: 'invitation.created',
      resourceType: 'invitation',
      resourceId: invitation.id,
      metadata: { email, role },
    });

    // No outbound email provider is configured in this reference implementation; the token
    // is returned directly so the invite flow is testable end-to-end. See docs/open-questions.
    res.status(201).json({ id: invitation.id, email, role, expiresAt: invitation.expiresAt, devInviteToken: token });
  })
);

const patchMemberSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'ANALYST']) });

organisationsRouter.patch(
  '/:organisationId/members/:memberId',
  requireOrgRole('OWNER', 'ADMIN'),
  validateBody(patchMemberSchema),
  asyncHandler(async (req, res) => {
    const member = await prisma.organisationMember.findFirst({
      where: { id: req.params.memberId, organisationId: req.params.organisationId },
    });
    if (!member) throw new ApiError('NOT_FOUND', 'Member not found.');

    const updated = await prisma.organisationMember.update({
      where: { id: member.id },
      data: { role: (req.body as z.infer<typeof patchMemberSchema>).role },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.params.organisationId,
      action: 'member.role_changed',
      resourceType: 'organisation_member',
      resourceId: member.id,
      metadata: { fromRole: member.role, toRole: updated.role },
    });

    res.json(updated);
  })
);

organisationsRouter.delete(
  '/:organisationId/members/:memberId',
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const member = await prisma.organisationMember.findFirst({
      where: { id: req.params.memberId, organisationId: req.params.organisationId },
    });
    if (!member) throw new ApiError('NOT_FOUND', 'Member not found.');

    await prisma.organisationMember.update({ where: { id: member.id }, data: { status: 'REMOVED' } });

    await recordAudit({
      actorUserId: req.user!.id,
      organisationId: req.params.organisationId,
      action: 'member.removed',
      resourceType: 'organisation_member',
      resourceId: member.id,
    });

    res.status(204).send();
  })
);

organisationsRouter.get(
  '/:organisationId/audit-logs',
  requireOrgRole('OWNER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({
      where: { organisationId: req.params.organisationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  })
);

export const invitationsRouter = Router();
invitationsRouter.use(requireAuth);

invitationsRouter.post(
  '/:token/accept',
  asyncHandler(async (req, res) => {
    const tokenHash = hashToken(req.params.token);
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new ApiError('TOKEN_INVALID', 'Invitation is invalid or expired.');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || user.email !== invitation.email) {
      throw new ApiError('FORBIDDEN', 'This invitation was issued to a different email address.');
    }

    await prisma.$transaction([
      prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
      prisma.organisationMember.upsert({
        where: { organisationId_userId: { organisationId: invitation.organisationId, userId: user.id } },
        create: { organisationId: invitation.organisationId, userId: user.id, role: invitation.role },
        update: { role: invitation.role, status: 'ACTIVE' },
      }),
    ]);

    await recordAudit({
      actorUserId: user.id,
      organisationId: invitation.organisationId,
      action: 'invitation.accepted',
      resourceType: 'invitation',
      resourceId: invitation.id,
    });

    res.json({ organisationId: invitation.organisationId, role: invitation.role });
  })
);
