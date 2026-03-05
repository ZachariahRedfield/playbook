import { execFileSync } from 'node:child_process';

export const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const withMergedEnv = (options = {}) => ({
  ...options,
  env: { ...process.env, ...(options.env ?? {}) }
});

const logFailureContext = (command, options = {}) => {
  if (command !== PNPM_BIN) return;
  const cwd = options.cwd ?? process.cwd();
  const pathLength = (process.env.PATH ?? '').length;
  console.error(`[spawn-debug] pathLength=${pathLength} pnpmBin=${PNPM_BIN} cwd=${cwd}`);
};

export const run = (command, args, options = {}) => {
  const mergedOptions = withMergedEnv(options);
  try {
    return execFileSync(command, args, {
      stdio: 'pipe',
      encoding: 'utf8',
      ...mergedOptions
    });
  } catch (error) {
    logFailureContext(command, mergedOptions);
    throw error;
  }
};

export const runLogged = (command, args, options = {}) => {
  const mergedOptions = withMergedEnv(options);
  try {
    return execFileSync(command, args, {
      stdio: 'inherit',
      ...mergedOptions
    });
  } catch (error) {
    logFailureContext(command, mergedOptions);
    throw error;
  }
};
