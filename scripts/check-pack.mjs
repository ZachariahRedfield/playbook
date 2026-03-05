import { execFileSync } from 'node:child_process';

const output = execFileSync('sh', ['-c', 'npm pack --dry-run 2>&1'], {
  cwd: 'packages/cli',
  encoding: 'utf8'
});

if (!output.includes('dist/cli.js')) {
  throw new Error('npm pack --dry-run missing dist/cli.js in packages/cli tarball output');
}

console.log('pack check passed: dist/cli.js included');
