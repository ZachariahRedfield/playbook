import fs from 'node:fs';
import path from 'node:path';
import { shouldSeedDefaultVersionPolicy, versionPolicyRelativePath, writeVersionPolicy } from './versionPolicy.js';

export type MigrationCheckContext = {
  repoRoot: string;
  fromVersion?: string;
  toVersion: string;
};

export type MigrationApplyContext = MigrationCheckContext & {
  dryRun: boolean;
};

export type MigrationCheckResult = {
  needed: boolean;
  reason: string;
};

export type MigrationApplyResult = {
  changed: boolean;
  filesChanged: string[];
  summary: string;
};

export type Migration = {
  id: string;
  introducedIn: string;
  description: string;
  safeToAutoApply: boolean;
  check: (context: MigrationCheckContext) => Promise<MigrationCheckResult>;
  apply?: (context: MigrationApplyContext) => Promise<MigrationApplyResult>;
};

const cliDocPath = (repoRoot: string): string => path.join(repoRoot, 'docs', 'REFERENCE', 'cli.md');

const readCliDoc = (repoRoot: string): string | undefined => {
  const filePath = cliDocPath(repoRoot);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  return fs.readFileSync(filePath, 'utf8');
};

const writeCliDoc = (repoRoot: string, content: string): void => {
  const filePath = cliDocPath(repoRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

const ensureTrailingNewline = (content: string): string => (content.endsWith('\n') ? content : `${content}\n`);

const explainOptionBlock = '- `--explain`: include why findings matter and suggested remediation details in text mode.';
const semanticsBlock =
  '> `playbook analyze` is informational (recommendations only). `playbook verify` enforces governance policy and can fail CI.';

export const migrationRegistry: Migration[] = [

  {
    id: 'policy.version.lockstep-default',
    introducedIn: '0.1.8',
    description: 'Seed .playbook/version-policy.json for publishable pnpm/node repositories so release governance is installable by default.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      if (!shouldSeedDefaultVersionPolicy(repoRoot)) {
        return { needed: false, reason: 'Repository is not an eligible publishable pnpm/node repo for default version policy seeding.' };
      }

      const policyPath = path.join(repoRoot, versionPolicyRelativePath);
      const needed = !fs.existsSync(policyPath);
      return {
        needed,
        reason: needed
          ? '.playbook/version-policy.json is missing for an eligible publishable pnpm/node repository.'
          : '.playbook/version-policy.json already exists.'
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const policyPath = path.join(repoRoot, versionPolicyRelativePath);
      if (fs.existsSync(policyPath)) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; .playbook/version-policy.json already exists.'
        };
      }

      if (dryRun) {
        return {
          changed: true,
          filesChanged: [versionPolicyRelativePath.replace(/\\/g, '/')],
          summary: 'Would seed .playbook/version-policy.json with the default lockstep version group.'
        };
      }

      writeVersionPolicy(repoRoot);
      return {
        changed: true,
        filesChanged: [versionPolicyRelativePath.replace(/\\/g, '/')],
        summary: 'Seeded .playbook/version-policy.json with the default lockstep version group.'
      };
    }
  },
  {
    id: 'docs.cli.explain-option',
    introducedIn: '0.1.2',
    description: 'Ensure CLI reference documents the `--explain` global flag.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      const content = readCliDoc(repoRoot);
      if (!content) {
        return { needed: true, reason: 'docs/REFERENCE/cli.md is missing.' };
      }
      const needed = !content.includes('--explain');
      return {
        needed,
        reason: needed
          ? 'CLI reference does not mention the `--explain` global option.'
          : 'CLI reference includes the `--explain` global option.'
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const original = readCliDoc(repoRoot) ?? '# CLI Reference\n\n## Global options (all top-level commands)\n';
      const alreadyPresent = original.includes('--explain');
      if (alreadyPresent) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; `--explain` already documented.'
        };
      }

      let updated = original;
      if (updated.includes('## Global options (all top-level commands)')) {
        const lines = updated.split('\n');
        const insertAt = lines.findIndex((line) => line.startsWith('## ') && line !== '## Global options (all top-level commands)');
        const targetIndex = insertAt === -1 ? lines.length : insertAt;
        lines.splice(targetIndex, 0, explainOptionBlock, '');
        updated = lines.join('\n');
      } else {
        updated = `${ensureTrailingNewline(updated)}\n## Global options (all top-level commands)\n\n${explainOptionBlock}\n`;
      }

      if (!dryRun) {
        writeCliDoc(repoRoot, ensureTrailingNewline(updated));
      }

      return {
        changed: true,
        filesChanged: ['docs/REFERENCE/cli.md'],
        summary: dryRun ? 'Would add `--explain` to CLI reference global options.' : 'Added `--explain` to CLI reference global options.'
      };
    }
  },
  {
    id: 'docs.cli.analyze-verify-semantics',
    introducedIn: '0.1.2',
    description: 'Ensure docs clarify analyze informational semantics versus verify policy enforcement.',
    safeToAutoApply: true,
    check: async ({ repoRoot }) => {
      const content = readCliDoc(repoRoot);
      if (!content) {
        return { needed: true, reason: 'docs/REFERENCE/cli.md is missing.' };
      }

      const hasAnalyze = content.includes('Analyze repository stack signals and output recommendations.');
      const hasVerify = content.includes('Run deterministic governance checks.');
      const hasSemantics = content.includes('informational') && content.includes('enforces governance policy');
      const needed = !(hasAnalyze && hasVerify && hasSemantics);

      return {
        needed,
        reason: needed
          ? 'CLI reference does not clearly explain analyze (informational) vs verify (enforcement) semantics.'
          : 'CLI reference explains analyze vs verify semantics.'
      };
    },
    apply: async ({ repoRoot, dryRun }) => {
      const original = readCliDoc(repoRoot) ?? '# CLI Reference\n';
      const hasSemantics = original.includes('informational') && original.includes('enforces governance policy');
      if (hasSemantics) {
        return {
          changed: false,
          filesChanged: [],
          summary: 'No changes needed; analyze vs verify semantics already documented.'
        };
      }

      const updated = `${ensureTrailingNewline(original)}\n${semanticsBlock}\n`;
      if (!dryRun) {
        writeCliDoc(repoRoot, ensureTrailingNewline(updated));
      }

      return {
        changed: true,
        filesChanged: ['docs/REFERENCE/cli.md'],
        summary: dryRun
          ? 'Would add analyze vs verify semantics note to CLI reference.'
          : 'Added analyze vs verify semantics note to CLI reference.'
      };
    }
  }
];
