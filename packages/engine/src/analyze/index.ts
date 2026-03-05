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

export type AnalyzeSeverity = 'WARN' | 'RECOMMEND' | 'INFO';

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

export type AnalyzeRecommendation = {
  id: string;
  title: string;
  severity: AnalyzeSeverity;
  message: string;
  why: string;
  fix: string;
  files?: string[];
};

export type AnalyzeResult = {
  repoPath: string;
  ok: boolean;
  detectorsRun: string[];
  detected: Array<Pick<DetectedStackItem, 'id' | 'label' | 'evidence'>>;
  summary: string;
  signals: string;
  recommendations: AnalyzeRecommendation[];
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

const renderSignals = (detected: DetectedStackItem[]): string => {
  if (!detected.length) return 'No known stack signals detected';
  const labels = detected.map((item) => item.label).join(', ');
  return `${detected.length} stack signal(s): ${labels}`;
};

const createRecommendations = (detected: DetectedStackItem[]): AnalyzeRecommendation[] => {
  if (!detected.length) {
    return [
      {
        id: 'analyze-no-signals',
        title: 'No stack signals detected',
        severity: 'WARN',
        message: 'No known stack detectors matched this repository.',
        why: 'Without stack signals, generated guidance may miss architecture-specific checks.',
        fix: 'Add key framework/database dependencies to package.json, then rerun playbook analyze.',
        files: ['package.json']
      },
      {
        id: 'analyze-run-init',
        title: 'Initialize governance baseline',
        severity: 'RECOMMEND',
        message: 'Ensure governance docs are initialized for this repository.',
        why: 'A documented baseline keeps architecture and delivery expectations explicit.',
        fix: 'Run `playbook init` to scaffold governance docs if they do not exist.'
      }
    ];
  }

  return [
    {
      id: 'analyze-run-verify',
      title: 'Run governance verification',
      severity: 'RECOMMEND',
      message: 'Use verify after analyze to enforce policy checks.',
      why: 'Analyze surfaces signals while verify enforces deterministic governance rules.',
      fix: 'Run `playbook verify` before opening a pull request.'
    },
    ...detected.map((item) => ({
      id: `analyze-detected-${item.id}`,
      title: `${item.label} detected`,
      severity: 'INFO' as const,
      message: `${item.label} signal detected from repository evidence.`,
      why: `${item.label} detection helps tailor architecture-aware guidance.`,
      fix: 'Review generated architecture suggestions and keep docs aligned with implementation.',
      files: ['package.json']
    }))
  ];
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
  const signals = renderSignals(detectorResults);
  const recommendations = createRecommendations(detectorResults);

  updateArchitectureSuggestions(repoRoot, detectorResults);

  return {
    repoPath: repoRoot,
    ok: !recommendations.some((recommendation) => recommendation.severity === 'WARN'),
    detectorsRun: getRegisteredDetectors().map((detector) => detector.id),
    detected: detectorResults.map(({ id, label, evidence }) => ({ id, label, evidence })),
    summary,
    signals,
    recommendations
  };
};
