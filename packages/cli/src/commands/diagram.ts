import fs from 'node:fs';
import path from 'node:path';
import { generateArchitectureDiagrams } from '@zachariahredfield/playbook-engine';

type DiagramOptions = {
  repo: string;
  out: string;
  deps: boolean;
  structure: boolean;
};

export const runDiagram = async (cwd: string, opts: DiagramOptions): Promise<number> => {
  const repo = path.resolve(cwd, opts.repo);
  const outFile = path.resolve(cwd, opts.out);

  const includeDeps = opts.deps || (!opts.deps && !opts.structure);
  const includeStructure = opts.structure || (!opts.deps && !opts.structure);

  const result = await generateArchitectureDiagrams(repo, {
    includeDeps,
    includeStructure,
    command: `playbook diagram --repo ${opts.repo} --out ${opts.out}${opts.deps ? ' --deps' : ''}${opts.structure ? ' --structure' : ''}`
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, result.markdown, 'utf8');

  console.log(`Generated architecture diagrams at ${path.relative(cwd, outFile)}`);
  return 0;
};
