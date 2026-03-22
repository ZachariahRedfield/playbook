import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { VerifyReport } from '../commands/verify.js';
import type { FixHandler } from './fixes.js';
import { notesEmptyRule } from '../rules/verify/notesEmptyRule.js';
import { notesMissingRule } from '../rules/verify/notesMissingRule.js';
import { requireNotesOnChangesRule } from '../rules/verify/requireNotesOnChangesRule.js';
import { testsRequiredRule } from '../rules/verify/testsRequiredRule.js';
import { protectedDocGovernanceRule } from '../rules/verify/protectedDocGovernanceRule.js';

export type VerifyFailure = VerifyReport['failures'][number];

export type VerifyRule = {
  id: string;
  description: string;
  check: (ctx: { failure: VerifyFailure }) => boolean;
  policy?: {
    id: string;
    description?: string;
  };
  fix?: FixHandler;
  explanation?: string;
  remediation?: string[];
};

type PluginVerifyRule = {
  id: string;
  description: string;
  verify: (ctx: { failure: VerifyFailure }) => boolean;
  policy?: {
    id: string;
    description?: string;
  };
  fix?: FixHandler;
  explanation?: string;
  remediation?: string[];
};

type PluginModule = {
  rules?: PluginVerifyRule[];
};

export const coreVerifyRules: VerifyRule[] = [notesMissingRule, notesEmptyRule, requireNotesOnChangesRule, testsRequiredRule, protectedDocGovernanceRule];

const readDependencyNames = (cwd: string): string[] => {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return [];
  }

  const raw = fs.readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {})
  ];

  return [...new Set(names)].filter((name) => /^playbook-plugin-/.test(name));
};

const toVerifyRule = (rule: PluginVerifyRule): VerifyRule | undefined => {
  if (!rule || typeof rule.id !== 'string' || typeof rule.description !== 'string' || typeof rule.verify !== 'function') {
    return undefined;
  }

  return {
    id: rule.id,
    description: rule.description,
    check: rule.verify,
    policy: rule.policy,
    fix: rule.fix,
    explanation: rule.explanation,
    remediation: rule.remediation
  };
};

const loadPluginRules = async (cwd: string): Promise<VerifyRule[]> => {
  const pluginRules: VerifyRule[] = [];

  for (const dependencyName of readDependencyNames(cwd)) {
    const pluginEntryPath = path.join(cwd, 'node_modules', dependencyName, 'index.js');
    if (!fs.existsSync(pluginEntryPath)) {
      continue;
    }

    try {
      const loaded = (await import(pathToFileURL(pluginEntryPath).href)) as PluginModule & { default?: PluginModule };
      const pluginModule = loaded.rules ? loaded : loaded.default;
      const rules = Array.isArray(pluginModule?.rules) ? pluginModule.rules : [];

      for (const pluginRule of rules) {
        const mapped = toVerifyRule(pluginRule);
        if (mapped) {
          pluginRules.push(mapped);
        }
      }
    } catch {
      // Ignore broken plugin modules and continue loading available rules.
    }
  }

  return pluginRules;
};

export const loadVerifyRules = async (cwd: string): Promise<VerifyRule[]> => {
  const merged = [...(await loadPluginRules(cwd)), ...coreVerifyRules];
  const deduped: VerifyRule[] = [];
  const seen = new Set<string>();

  for (const rule of merged) {
    if (seen.has(rule.id)) {
      continue;
    }
    seen.add(rule.id);
    deduped.push(rule);
  }

  return deduped;
};
