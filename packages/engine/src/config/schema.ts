export type PlaybookConfig = {
  version: 1;
  docs: {
    notesPath: string;
    architecturePath: string;
    governancePath: string;
    checklistPath: string;
  };
  analyze: {
    detectors: string[];
  };
  plugins: string[];
  verify: {
    policy: {
      rules: string[];
    };
    rules: {
      requireNotesOnChanges: Array<{
        whenChanged: string[];
        mustTouch: string[];
      }>;
    };
  };
};

export const defaultConfig: PlaybookConfig = {
  version: 1,
  docs: {
    notesPath: 'docs/PLAYBOOK_NOTES.md',
    architecturePath: 'docs/ARCHITECTURE.md',
    governancePath: 'docs/PROJECT_GOVERNANCE.md',
    checklistPath: 'docs/PLAYBOOK_CHECKLIST.md'
  },
  analyze: {
    detectors: ['nextjs', 'supabase', 'tailwind']
  },
  plugins: [],
  verify: {
    policy: {
      rules: []
    },
    rules: {
      requireNotesOnChanges: [
        {
          whenChanged: ['src/**', 'app/**', 'server/**', 'supabase/**'],
          mustTouch: ['docs/PLAYBOOK_NOTES.md']
        }
      ]
    }
  }
};
