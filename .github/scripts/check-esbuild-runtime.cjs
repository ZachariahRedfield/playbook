function checkEsbuildRuntime() {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Unable to require("esbuild"): ${message}` };
  }

  try {
    const result = esbuild.transformSync('export const sentinel = 1', {
      loader: 'js',
      format: 'cjs',
      target: 'node18'
    });
    if (!result || typeof result.code !== 'string' || result.code.length === 0) {
      return { ok: false, message: 'esbuild.transformSync returned no emitted code.' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `esbuild transform smoke test failed: ${message}` };
  }

  return { ok: true, version: String(esbuild.version ?? 'unknown') };
}

if (require.main === module) {
  const result = checkEsbuildRuntime();
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(`esbuild runtime usable (version ${result.version}).`);
}

module.exports = {
  checkEsbuildRuntime,
};
