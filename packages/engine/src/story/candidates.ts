import fs from 'node:fs';
import path from 'node:path';
import {
  STORIES_RELATIVE_PATH,
  createStoryRecord,
  readStoriesArtifact,
  upsertStory,
  type CreateStoryInput,
  type StoryRecord,
  type StoriesArtifact
} from './stories.js';

export type StoryCandidateInput = CreateStoryInput;

export type StoryCandidateGenerationResult = {
  repo: string;
  candidates: StoryRecord[];
};

const writeStoriesArtifact = (repoRoot: string, artifact: StoriesArtifact): string => {
  const targetPath = path.join(repoRoot, STORIES_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return targetPath;
};

export const generateStoryCandidates = (repoRoot: string, inputs: StoryCandidateInput[]): StoryCandidateGenerationResult => {
  const repo = readStoriesArtifact(repoRoot).repo;
  return {
    repo,
    candidates: inputs.map((input) => createStoryRecord(repo, input))
  };
};

export const promoteStoryCandidate = (repoRoot: string, candidate: StoryRecord): { story: StoryRecord; artifact: StoriesArtifact; artifactPath: string } => {
  const current = readStoriesArtifact(repoRoot);
  const nextArtifact = upsertStory(current, { ...candidate, repo: current.repo });
  const artifactPath = writeStoriesArtifact(repoRoot, nextArtifact);
  return {
    story: nextArtifact.stories.find((story) => story.id === candidate.id) ?? { ...candidate, repo: current.repo },
    artifact: nextArtifact,
    artifactPath
  };
};
