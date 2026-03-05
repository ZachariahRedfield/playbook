import fs from 'node:fs';
import path from 'node:path';
import { loadPlugins } from '../plugins/loadPlugins.js';
import {
  getRegisteredDetectors,
  registerDetector,
  resetPluginRegistry
} from '../plugins/pluginRegistry.js';
import type { RepoContext, StackDetector } from '../plugins/pluginTypes.js';
import { nextjsDetector } from './detectors/nextjs.js';
import { supabaseDetector } from './detectors/supabase.js';
import { tailwindDetector } from './detectors/tailwind.js';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type DetectedStackItem = {
  id: string;
  label: string;
  confidence: number;
  evidence: string[];
};

export type AnalyzeResult = {
  detectorsRun: string[];
  detected: Array<Pick<DetectedStackItem, 'id' | 'label' | 'evidence'>>;
  summary: string;
};

const readPackageJson = (repoRoot: string): PackageJson => {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
};

const coreDetectors: StackDetector[] = [
  nextjsDetector,
  supabaseDetector,
  tailwindDetector
];

const renderSummary = (detected: DetectedStackItem[]): string => {
  if (!detected.length) return 'Detected stack: none';
  const lines = detected.map((item) => `- ${item.label}`);
  return ['Detected stack:', ...lines].join('\n');
};

const architectureCategoryByDetector: Record<string, string> = {
  nextjs: 'Framework',
  supabase: 'Database',
  tailwind: 'Styling'
};

const updateArchitectureSuggestions = (repoRoot: string, detected: DetectedStackItem[]): void => {
  const architecture = path.join(repoRoot, 'docs', 'ARCHITECTURE.md');
  if (!fs.existsSync(architecture)) return;

  const marker = '<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->';
  const content = fs.readFileSync(architecture, 'utf8');
  if (!content.includes(marker)) return;

  const suggestionLines = detected
    .map((item) => {
      const category = architectureCategoryByDetector[item.id];
      return category ? `- ${category}: ${item.label}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (!suggestionLines.length) return;
  const suggestionBlock = `${marker}\n${suggestionLines.join('\n')}`;

  const markerLineRegex = new RegExp(
    `${marker}\\n(?:- (?:Framework|Database|Styling): .*\\n?)*`,
    'g'
  );
  const replaced = content.replace(markerLineRegex, `${suggestionBlock}\n`);

  if (replaced !== content) fs.writeFileSync(architecture, replaced);
};

export const analyzeRepo = (repoRoot: string): AnalyzeResult => {
  const pkg = readPackageJson(repoRoot);
  const repoContext: RepoContext = {
    repoRoot,
    packageJsonPath: path.join(repoRoot, 'package.json'),
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {}
  };

  resetPluginRegistry();
  coreDetectors.forEach(registerDetector);
  loadPlugins(repoRoot);

  const detectorResults = getRegisteredDetectors().flatMap((detector) => {
    const result = detector.detect(repoContext);
    if (!result) return [];
    return [{ id: detector.id, label: detector.label, ...result }];
  });

  const summary = renderSummary(detectorResults);

  updateArchitectureSuggestions(repoRoot, detectorResults);

  return {
    detectorsRun: getRegisteredDetectors().map((detector) => detector.id),
    detected: detectorResults.map(({ id, label, evidence }) => ({ id, label, evidence })),
    summary
  };
};
