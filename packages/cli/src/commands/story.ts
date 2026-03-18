import { createStoryRecord, readStoriesArtifact, STORIES_RELATIVE_PATH, STORY_STATUSES, STORY_TYPES, STORY_SEVERITIES, STORY_PRIORITIES, STORY_CONFIDENCES, upsertStory, updateStoryStatus, validateStoriesArtifact, type StoryRecord, type StoryStatus } from '@zachariahredfield/playbook-engine';
import { ExitCode } from '../lib/cliContract.js';
import { stageWorkflowArtifact } from '../lib/workflowPromotion.js';

type StoryCommandOptions = { format: 'text' | 'json'; quiet: boolean };

const readOption = (args: string[], name: string): string | null => {
  const exact = args.findIndex((arg) => arg === name);
  if (exact >= 0) return args[exact + 1] ?? null;
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : null;
};
const readListOption = (args: string[], name: string): string[] => args.flatMap((arg, index) => args[index - 1] === name ? [arg] : []).filter((value): value is string => Boolean(value));
const print = (format: 'text' | 'json', payload: unknown): void => {
  if (format === 'json') console.log(JSON.stringify(payload, null, 2));
  else console.log(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
};
const usage = 'Usage: playbook story <list|show|create|status> [options]';

export const runStory = async (cwd: string, args: string[], options: StoryCommandOptions): Promise<number> => {
  const subcommand = args[0];
  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    print(options.format, usage);
    return subcommand ? ExitCode.Success : ExitCode.Failure;
  }

  if (subcommand === 'list') {
    const artifact = readStoriesArtifact(cwd);
    print(options.format, { schemaVersion: '1.0', command: 'story.list', repo: artifact.repo, stories: artifact.stories });
    return ExitCode.Success;
  }

  if (subcommand === 'show') {
    const id = args[1];
    if (!id) {
      print(options.format, { schemaVersion: '1.0', command: 'story.show', error: 'Missing story id.' });
      return ExitCode.Failure;
    }
    const artifact = readStoriesArtifact(cwd);
    const story = artifact.stories.find((entry: StoryRecord) => entry.id === id);
    if (!story) {
      print(options.format, { schemaVersion: '1.0', command: 'story.show', id, error: `Story not found: ${id}` });
      return ExitCode.Failure;
    }
    print(options.format, { schemaVersion: '1.0', command: 'story.show', id, story });
    return ExitCode.Success;
  }

  if (subcommand === 'create') {
    const id = readOption(args, '--id');
    const title = readOption(args, '--title');
    const type = readOption(args, '--type');
    const source = readOption(args, '--source');
    const severity = readOption(args, '--severity');
    const priority = readOption(args, '--priority');
    const confidence = readOption(args, '--confidence');
    const rationale = readOption(args, '--rationale') ?? '';
    const lane = readOption(args, '--execution-lane');
    const route = readOption(args, '--suggested-route');
    const evidence = readListOption(args, '--evidence');
    const acceptance = readListOption(args, '--acceptance');
    const dependencies = readListOption(args, '--depends-on');
    const errors = [] as string[];
    if (!id) errors.push('Missing required option --id');
    if (!title) errors.push('Missing required option --title');
    if (!type) errors.push('Missing required option --type');
    if (!source) errors.push('Missing required option --source');
    if (!severity) errors.push('Missing required option --severity');
    if (!priority) errors.push('Missing required option --priority');
    if (!confidence) errors.push('Missing required option --confidence');
    if (type && !STORY_TYPES.includes(type as never)) errors.push(`Invalid --type value "${type}"`);
    if (severity && !STORY_SEVERITIES.includes(severity as never)) errors.push(`Invalid --severity value "${severity}"`);
    if (priority && !STORY_PRIORITIES.includes(priority as never)) errors.push(`Invalid --priority value "${priority}"`);
    if (confidence && !STORY_CONFIDENCES.includes(confidence as never)) errors.push(`Invalid --confidence value "${confidence}"`);
    const current = readStoriesArtifact(cwd);
    const nextStory = errors.length === 0 ? createStoryRecord(current.repo, {
      id: id!, title: title!, type: type as never, source: source!, severity: severity as never, priority: priority as never, confidence: confidence as never,
      rationale, evidence, acceptance_criteria: acceptance, dependencies, execution_lane: lane, suggested_route: route
    }) : null;
    if (nextStory && current.stories.some((story: StoryRecord) => story.id === nextStory.id)) errors.push(`Story already exists: ${nextStory.id}`);
    const nextArtifact = nextStory ? upsertStory(current, nextStory) : current;
    const promotion = stageWorkflowArtifact({
      cwd,
      workflowKind: 'story-create',
      candidateRelativePath: '.playbook/stories.staged.json',
      committedRelativePath: STORIES_RELATIVE_PATH,
      artifact: nextArtifact,
      validate: () => errors.length > 0 ? errors : validateStoriesArtifact(nextArtifact),
      generatedAt: new Date().toISOString(),
      successSummary: `Created story ${id}`,
      blockedSummary: 'Story creation blocked; committed backlog state preserved.'
    });
    print(options.format, { schemaVersion: '1.0', command: 'story.create', story: nextStory, promotion });
    return promotion.promoted ? ExitCode.Success : ExitCode.PolicyFailure;
  }

  if (subcommand === 'status') {
    const id = args[1];
    const status = readOption(args, '--status');
    if (!id || !status) {
      print(options.format, { schemaVersion: '1.0', command: 'story.status', error: 'Usage: playbook story status <id> --status <status>' });
      return ExitCode.Failure;
    }
    const current = readStoriesArtifact(cwd);
    const story = current.stories.find((entry: StoryRecord) => entry.id === id);
    const errors: string[] = [];
    if (!story) errors.push(`Story not found: ${id}`);
    if (!STORY_STATUSES.includes(status as StoryStatus)) errors.push(`Invalid --status value "${status}"`);
    const nextArtifact = errors.length === 0 ? updateStoryStatus(current, id, status as StoryStatus) : current;
    const promotion = stageWorkflowArtifact({
      cwd,
      workflowKind: 'story-status',
      candidateRelativePath: '.playbook/stories.staged.json',
      committedRelativePath: STORIES_RELATIVE_PATH,
      artifact: nextArtifact,
      validate: () => errors.length > 0 ? errors : validateStoriesArtifact(nextArtifact),
      generatedAt: new Date().toISOString(),
      successSummary: `Updated story ${id} to status ${status}`,
      blockedSummary: 'Story status update blocked; committed backlog state preserved.'
    });
    print(options.format, { schemaVersion: '1.0', command: 'story.status', id, status, story: nextArtifact.stories.find((entry: StoryRecord) => entry.id === id) ?? null, promotion });
    return promotion.promoted ? ExitCode.Success : ExitCode.PolicyFailure;
  }

  print(options.format, { schemaVersion: '1.0', command: 'story', error: `Unsupported subcommand: ${subcommand}`, usage });
  return ExitCode.Failure;
};
