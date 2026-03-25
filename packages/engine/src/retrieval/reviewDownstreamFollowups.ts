import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  REVIEW_HANDOFF_ROUTES_RELATIVE_PATH,
  type ReviewHandoffRouteEntry,
  type ReviewHandoffRoutesArtifact
} from './reviewHandoffRoutes.js';

export const REVIEW_DOWNSTREAM_FOLLOWUPS_SCHEMA_VERSION = '1.0' as const;
export const REVIEW_DOWNSTREAM_FOLLOWUPS_RELATIVE_PATH = '.playbook/review-downstream-followups.json' as const;

export type ReviewDownstreamFollowupType = 'docs-revision' | 'promote-memory' | 'story-seed' | 'supersession';

export type ReviewDownstreamFollowupEntry = {
  followupId: string;
  type: ReviewDownstreamFollowupType;
  routeId: string;
  handoffId: string;
  targetKind: ReviewHandoffRouteEntry['targetKind'];
  targetId?: string;
  path?: string;
  recommendedSurface: ReviewHandoffRouteEntry['recommendedSurface'];
  recommendedArtifact: string;
  reasonCode: string;
  evidenceRefs: string[];
  nextActionText: string;
};

export type ReviewDownstreamFollowupsArtifact = {
  schemaVersion: typeof REVIEW_DOWNSTREAM_FOLLOWUPS_SCHEMA_VERSION;
  kind: 'playbook-review-downstream-followups';
  proposalOnly: true;
  authority: 'read-only';
  generatedAt: string;
  followups: ReviewDownstreamFollowupEntry[];
};

const EMPTY_ROUTES: ReviewHandoffRoutesArtifact = {
  schemaVersion: '1.0',
  kind: 'playbook-review-handoff-routes',
  proposalOnly: true,
  authority: 'read-only',
  generatedAt: new Date(0).toISOString(),
  routes: []
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asIso = (value: string | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
};

const ensureUniqueSortedStrings = (values: readonly string[]): string[] =>
  [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort((left, right) => left.localeCompare(right));

const readRouteArtifact = (repoRoot: string): ReviewHandoffRoutesArtifact => {
  const fullPath = path.join(repoRoot, REVIEW_HANDOFF_ROUTES_RELATIVE_PATH);
  if (!fs.existsSync(fullPath)) {
    return EMPTY_ROUTES;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.routes)) {
      return EMPTY_ROUTES;
    }

    const routes = parsed.routes.filter(
      (entry): entry is ReviewHandoffRouteEntry => isRecord(entry) && typeof entry.routeId === 'string' && entry.routeId.length > 0
    );

    return {
      ...EMPTY_ROUTES,
      generatedAt: asIso(typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined, EMPTY_ROUTES.generatedAt),
      routes
    };
  } catch {
    return EMPTY_ROUTES;
  }
};

const classifyFollowupType = (route: ReviewHandoffRouteEntry): ReviewDownstreamFollowupType => {
  if (route.reasonCode === 'docs-revision-follow-up' || route.recommendedSurface === 'docs') {
    return 'docs-revision';
  }
  if (route.reasonCode === 'story-seed-operational-gap' || route.recommendedSurface === 'story') {
    return 'story-seed';
  }
  if (route.reasonCode === 'supersession-follow-up') {
    return 'supersession';
  }
  return 'promote-memory';
};

const buildFollowupId = (route: ReviewHandoffRouteEntry, followupType: ReviewDownstreamFollowupType): string =>
  createHash('sha256')
    .update([route.routeId, route.handoffId, followupType, route.reasonCode, route.recommendedArtifact].join('|'))
    .digest('hex')
    .slice(0, 16);

const sortFollowups = (entries: ReviewDownstreamFollowupEntry[]): ReviewDownstreamFollowupEntry[] =>
  [...entries].sort((left, right) =>
    left.type.localeCompare(right.type) ||
    left.handoffId.localeCompare(right.handoffId) ||
    left.routeId.localeCompare(right.routeId) ||
    left.followupId.localeCompare(right.followupId)
  );

export const buildReviewDownstreamFollowupsArtifact = (
  repoRoot: string,
  generatedAt: string = new Date().toISOString()
): ReviewDownstreamFollowupsArtifact => {
  const routeArtifact = readRouteArtifact(repoRoot);
  const followups = routeArtifact.routes
    .filter((route) => route.targetId || route.path)
    .map((route) => {
      const type = classifyFollowupType(route);
      return {
        followupId: buildFollowupId(route, type),
        type,
        routeId: route.routeId,
        handoffId: route.handoffId,
        targetKind: route.targetKind,
        ...(route.targetId ? { targetId: route.targetId } : {}),
        ...(route.path ? { path: route.path } : {}),
        recommendedSurface: route.recommendedSurface,
        recommendedArtifact: route.recommendedArtifact,
        reasonCode: route.reasonCode,
        evidenceRefs: ensureUniqueSortedStrings(route.evidenceRefs),
        nextActionText: route.nextActionText
      } satisfies ReviewDownstreamFollowupEntry;
    });

  return {
    schemaVersion: REVIEW_DOWNSTREAM_FOLLOWUPS_SCHEMA_VERSION,
    kind: 'playbook-review-downstream-followups',
    proposalOnly: true,
    authority: 'read-only',
    generatedAt: asIso(generatedAt, new Date().toISOString()),
    followups: sortFollowups(followups)
  };
};

export const writeReviewDownstreamFollowupsArtifact = (repoRoot: string, artifact: ReviewDownstreamFollowupsArtifact): string => {
  const outputPath = path.join(repoRoot, REVIEW_DOWNSTREAM_FOLLOWUPS_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return outputPath;
};
