import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeRepo } from '../src/analyze/index.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

const writePackageJson = (repoRoot: string, pkg: object): void => {
  fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify(pkg, null, 2));
};

describe('analyze detectors', () => {
  it('detects Next.js via dependency and structure evidence', () => {
    const repo = createRepo('playbook-nextjs-test');
    writePackageJson(repo, { dependencies: { next: '^15.0.0' } });
    fs.mkdirSync(path.join(repo, 'app'));

    const result = analyzeRepo(repo);
    const detection = result.detected.find((item) => item.id === 'nextjs');

    expect(detection).toBeDefined();
    expect(detection?.label).toBe('Next.js');
    expect(detection?.evidence).toContain('dependency:next');
    expect(detection?.evidence).toContain('directory:app/');
  });

  it('detects Supabase via config and dependency evidence', () => {
    const repo = createRepo('playbook-supabase-test');
    writePackageJson(repo, { dependencies: { '@supabase/supabase-js': '^2.0.0' } });
    fs.mkdirSync(path.join(repo, 'supabase', 'migrations'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'supabase', 'config.toml'), 'project_id = "test"');

    const result = analyzeRepo(repo);
    const detection = result.detected.find((item) => item.id === 'supabase');

    expect(detection).toBeDefined();
    expect(detection?.label).toBe('Supabase');
    expect(detection?.evidence).toContain('file:supabase/config.toml');
    expect(detection?.evidence).toContain('directory:supabase/migrations');
    expect(detection?.evidence).toContain('dependency:@supabase/supabase-js');
  });

  it('detects Tailwind via config and dependency evidence', () => {
    const repo = createRepo('playbook-tailwind-test');
    writePackageJson(repo, { devDependencies: { tailwindcss: '^4.0.0' } });
    fs.writeFileSync(path.join(repo, 'tailwind.config.ts'), 'export default {};');

    const result = analyzeRepo(repo);
    const detection = result.detected.find((item) => item.id === 'tailwind');

    expect(detection).toBeDefined();
    expect(detection?.label).toBe('Tailwind');
    expect(detection?.evidence).toContain('config:tailwind.config.ts');
    expect(detection?.evidence).toContain('dependency:tailwindcss');
  });

  it('returns detector metadata and stack summary and updates architecture suggestions idempotently', () => {
    const repo = createRepo('playbook-analyze-stack-test');
    writePackageJson(repo, {
      dependencies: {
        next: '^15.0.0',
        '@supabase/supabase-js': '^2.0.0'
      },
      devDependencies: {
        tailwindcss: '^4.0.0'
      }
    });

    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    const architecturePath = path.join(repo, 'docs', 'ARCHITECTURE.md');
    fs.writeFileSync(
      architecturePath,
      ['# Architecture', '', '<!-- PLAYBOOK:ANALYZE_SUGGESTIONS -->', '', '## Notes'].join('\n')
    );

    const first = analyzeRepo(repo);
    const second = analyzeRepo(repo);

    expect(first.detectorsRun).toContain('nextjs');
    expect(first.detectorsRun).toContain('supabase');
    expect(first.detectorsRun).toContain('tailwind');
    expect(first.summary).toContain('Detected stack:');
    expect(first.summary).toContain('- Next.js');
    expect(first.summary).toContain('- Supabase');
    expect(first.summary).toContain('- Tailwind');

    expect(second.detected).toEqual(first.detected);

    const architecture = fs.readFileSync(architecturePath, 'utf8');
    expect(architecture.match(/- Framework: Next\.js/g)).toHaveLength(1);
    expect(architecture.match(/- Database: Supabase/g)).toHaveLength(1);
    expect(architecture.match(/- Styling: Tailwind/g)).toHaveLength(1);
  });
});
