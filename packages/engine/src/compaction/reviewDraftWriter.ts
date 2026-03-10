import fs from 'node:fs';
import path from 'node:path';
import type { PatternCardReviewDraftArtifact } from './patternCardTypes.js';

export const COMPACTION_REVIEW_DRAFT_RELATIVE_PATH = '.playbook/compaction/review-drafts.json' as const;

export const writeCompactionReviewDraftArtifact = (repoRoot: string, artifact: PatternCardReviewDraftArtifact): string => {
  const artifactPath = path.join(repoRoot, COMPACTION_REVIEW_DRAFT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifactPath;
};
