export type BriefList = Array<string | null | undefined | false>;

export type BriefSection = {
  heading: string;
  items: BriefList;
  emptyText?: string;
};

export type BriefReport = {
  title: string;
  decision: string;
  affectedSurfaces?: BriefList;
  blockers?: BriefList;
  nextAction: string;
  sections?: BriefSection[];
};

const normalizeItems = (items: BriefList | undefined): string[] =>
  (items ?? [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const renderBriefReport = (report: BriefReport): string => {
  const lines = [report.title, '─'.repeat(report.title.length), `Decision: ${report.decision}`];

  const affectedSurfaces = normalizeItems(report.affectedSurfaces);
  lines.push(`Affected surfaces: ${affectedSurfaces.length > 0 ? affectedSurfaces.join('; ') : 'none'}`);

  const blockers = normalizeItems(report.blockers);
  lines.push(`Blockers: ${blockers.length > 0 ? blockers.join('; ') : 'none'}`);
  lines.push(`Next action: ${report.nextAction}`);

  for (const section of report.sections ?? []) {
    const items = normalizeItems(section.items);
    if (items.length === 0 && !section.emptyText) {
      continue;
    }

    lines.push('', section.heading);
    if (items.length === 0) {
      lines.push(`- ${section.emptyText}`);
      continue;
    }

    for (const item of items) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join('\n');
};
