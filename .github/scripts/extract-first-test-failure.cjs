const fs = require('node:fs');
const path = require('node:path');

function extractFirstTestFailure(logContent) {
  const lines = String(logContent ?? '').replace(/\r/g, '').split('\n');
  let file = null;
  let test = null;
  let message = null;

  for (const line of lines) {
    const vitestFail = line.match(/FAIL\s+(.+?)\s+\[/);
    if (vitestFail && !file) {
      file = vitestFail[1].trim();
      continue;
    }

    const nodeTestFail = line.match(/^not ok \d+ - (.+)$/);
    if (nodeTestFail && !test) {
      test = nodeTestFail[1].trim();
      continue;
    }

    if (!message) {
      const messageMatch = line.match(/(AssertionError|Error):\s+.+$/);
      if (messageMatch) {
        message = messageMatch[0].trim();
      }
    }
  }

  if (!message) {
    const fallback = lines.find((line) => line.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL') || line.includes('ELIFECYCLE') || line.includes('Failed Suites'));
    message = fallback ? fallback.trim() : null;
  }

  return {
    schemaVersion: '1.0',
    kind: 'playbook-first-test-failure',
    found: Boolean(file || test || message),
    file: file ?? '(unknown)',
    test: test ?? '(unknown)',
    message: message ?? '(unknown)',
  };
}

function parseArgs(argv) {
  const options = {
    input: '.playbook/ci-failure.log',
    out: '.playbook/first-test-failure.json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--input' && next) {
      options.input = next;
      index += 1;
    } else if (token === '--out' && next) {
      options.out = next;
      index += 1;
    }
  }
  return options;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.input);
  const outPath = path.resolve(process.cwd(), options.out);

  if (!fs.existsSync(inputPath)) {
    const payload = {
      schemaVersion: '1.0',
      kind: 'playbook-first-test-failure',
      found: false,
      file: '(unknown)',
      test: '(unknown)',
      message: `input log missing: ${options.input}`,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(0);
  }

  const payload = extractFirstTestFailure(fs.readFileSync(inputPath, 'utf8'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

module.exports = {
  extractFirstTestFailure,
  parseArgs,
};
