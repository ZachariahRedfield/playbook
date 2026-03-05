import fs from 'node:fs';
import path from 'node:path';
import { generateArchitectureDiagrams } from '@zachariahredfield/playbook-engine';
import { emitResult, ExitCode } from '../lib/cliContract.js';

type DiagramOptions = {
  repo: string;
  out: string;
  deps: boolean;
  structure: boolean;
  format: 'text' | 'json';
  quiet: boolean;
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

  emitResult({
    format: opts.format,
    quiet: opts.quiet,
    command: 'diagram',
    ok: true,
    exitCode: ExitCode.Success,
    summary: `Generated architecture diagrams at ${path.relative(cwd, outFile)}`,
    findings: [
      {
        id: 'diagram.output.written',
        level: 'info',
        message: `Wrote ${path.relative(cwd, outFile)}`
      },
      { id: 'diagram.include.deps', level: 'info', message: `Dependency diagram: ${includeDeps ? 'included' : 'excluded'}` },
      {
        id: 'diagram.include.structure',
        level: 'info',
        message: `Structure diagram: ${includeStructure ? 'included' : 'excluded'}`
      }
    ],
    nextActions: []
  });

  return ExitCode.Success;
};
