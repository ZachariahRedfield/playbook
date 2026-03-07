import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRepositoryIndex } from '../src/indexer/repoIndexer.js';

const createRepo = (name: string): string => fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));

describe('generateRepositoryIndex', () => {
  it('builds deterministic repository intelligence from simple heuristics', () => {
    const repo = createRepo('playbook-repo-index');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ dependencies: { '@supabase/supabase-js': '^2.0.0' } }, null, 2));
    fs.writeFileSync(path.join(repo, 'next.config.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(repo, 'tsconfig.json'), '{}');
    fs.mkdirSync(path.join(repo, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'src', 'api', 'index.ts'), "import { card } from '../ui/card';\nexport const api = card;\n");

    const index = generateRepositoryIndex(repo);

    expect(index).toEqual({
      schemaVersion: '1.0',
      framework: 'nextjs',
      language: 'typescript',
      architecture: 'modular-monolith',
      modules: [
        { name: 'api', dependencies: ['ui'] },
        { name: 'ui', dependencies: [] }
      ],
      database: 'supabase',
      rules: ['requireNotesFileWhenGovernanceExists', 'requireNotesOnChanges', 'verify.rule.tests.required']
    });
  });

  it('respects architecture override from playbook config', () => {
    const repo = createRepo('playbook-repo-index-architecture');
    fs.writeFileSync(path.join(repo, 'playbook.config.json'), JSON.stringify({ architecture: 'microservices' }, null, 2));

    const index = generateRepositoryIndex(repo);

    expect(index.architecture).toBe('microservices');
  });

  it('respects .playbookignore when scanning source modules', () => {
    const repo = createRepo('playbook-repo-index-ignore');
    fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({}, null, 2));
    fs.mkdirSync(path.join(repo, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'src', 'generated'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.playbookignore'), 'src/generated\n');
    fs.writeFileSync(path.join(repo, 'src', 'api', 'index.ts'), "export const api = true;\n");
    fs.writeFileSync(path.join(repo, 'src', 'generated', 'index.ts'), "export const generated = true;\n");

    const index = generateRepositoryIndex(repo);

    expect(index.modules).toEqual([{ name: 'api', dependencies: [] }]);
  });

});
