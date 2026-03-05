import { describe, expect, it } from 'vitest';
import type { AnalyzeResult } from '../src/analyze/index.js';
import { formatAnalyzeCi, formatAnalyzeHuman, formatAnalyzeJson } from '../src/format/analyze.js';

const fixtureReport: AnalyzeResult = {
  repoPath: '/repo',
  ok: false,
  detectorsRun: ['nextjs', 'supabase', 'tailwind'],
  detected: [
    { id: 'nextjs', label: 'Next.js', evidence: ['dependency:next'] },
    { id: 'supabase', label: 'Supabase', evidence: ['dependency:@supabase/supabase-js'] }
  ],
  summary: 'Detected stack:\n- Next.js\n- Supabase',
  signals: '2 stack signal(s): Next.js, Supabase',
  recommendations: [
    {
      id: 'warn-missing-arch',
      title: 'Architecture docs missing marker',
      severity: 'WARN',
      message: 'Architecture marker was not found.',
      why: 'Without a marker, analyze cannot inject architecture suggestions automatically.',
      fix: 'Add <!-- PLAYBOOK:ANALYZE_SUGGESTIONS --> to docs/ARCHITECTURE.md.',
      files: ['docs/ARCHITECTURE.md']
    },
    {
      id: 'recommend-run-verify',
      title: 'Run verify before opening a PR',
      severity: 'RECOMMEND',
      message: 'Verify enforces governance checks.',
      why: 'Analyze surfaces signals while verify enforces governance contracts.',
      fix: 'Run `playbook verify`.'
    },
    {
      id: 'info-next',
      title: 'Next.js detected',
      severity: 'INFO',
      message: 'Detected Next.js.',
      why: 'Next.js detection improves architecture recommendations.',
      fix: 'Review generated architecture suggestions.',
      files: ['package.json']
    }
  ]
};

describe('analyze formatter', () => {
  it('formats stable human output', () => {
    expect(formatAnalyzeHuman(fixtureReport)).toMatchSnapshot();
  });

  it('formats stable CI output', () => {
    expect(formatAnalyzeCi(fixtureReport)).toMatchSnapshot();
  });

  it('formats stable JSON output', () => {
    expect(formatAnalyzeJson(fixtureReport)).toMatchSnapshot();
  });
});
