import { describe, expect, it } from 'vitest';
import { enforceApplyChangeScope, type ApplyChangeScope } from './changeScopeEnforcement.js';
import type { PlanTask } from './types.js';

const createScope = (overrides: Partial<ApplyChangeScope> = {}): ApplyChangeScope => ({
  scopeId: 'scope-test',
  allowedFiles: ['packages/cli/src/commands/apply.ts'],
  patchSizeBudget: {
    maxFiles: 1,
    maxHunks: 2,
    maxAddedLines: 20,
    maxRemovedLines: 20
  },
  boundaryChecks: ['no-mutation-authority-escalation', 'writes-must-stay-inside-allowedFiles'],
  ...overrides
});

const managedWriteTask: PlanTask = {
  id: 'task-1',
  ruleId: 'docs-consolidation.managed-write',
  file: 'packages/cli/src/commands/apply.ts',
  action: 'update file',
  autoFix: true,
  write: {
    operation: 'replace-managed-block',
    blockId: 'block',
    startMarker: '<!-- START -->',
    endMarker: '<!-- END -->',
    content: 'line-1\nline-2\n'
  }
};

describe('enforceApplyChangeScope', () => {
  it('accepts in-scope mutation within budget', () => {
    expect(() => enforceApplyChangeScope([managedWriteTask], createScope())).not.toThrow();
  });

  it('fails when task file is outside allowedFiles', () => {
    const outOfScopeTask: PlanTask = {
      ...managedWriteTask,
      file: 'packages/engine/src/index.ts'
    };
    expect(() => enforceApplyChangeScope([outOfScopeTask], createScope())).toThrow(/out-of-scope mutation requested/);
  });

  it('fails when estimated patch budget is exceeded', () => {
    const tightScope = createScope({
      patchSizeBudget: {
        maxFiles: 1,
        maxHunks: 1,
        maxAddedLines: 1,
        maxRemovedLines: 20
      }
    });

    expect(() => enforceApplyChangeScope([managedWriteTask], tightScope)).toThrow(/patch budget exceeded/);
  });

  it('fails when required boundary checks are missing or red', () => {
    expect(() =>
      enforceApplyChangeScope([managedWriteTask], createScope({ boundaryChecks: ['writes-must-stay-inside-allowedFiles:red'] }))
    ).toThrow(/required boundary checks are missing/);

    expect(() =>
      enforceApplyChangeScope(
        [managedWriteTask],
        createScope({ boundaryChecks: ['no-mutation-authority-escalation:red', 'writes-must-stay-inside-allowedFiles'] })
      )
    ).toThrow(/boundary checks are red/);
  });
});
