export const ZETTEL_KIND = ['observation', 'question', 'decision', 'pattern', 'risk'] as const;

export type ZettelKind = (typeof ZETTEL_KIND)[number];

export const ZETTEL_LINK_RELATION = ['supports', 'contradicts', 'refines', 'depends_on', 'derived_from'] as const;

export type ZettelLinkRelation = (typeof ZETTEL_LINK_RELATION)[number];

export type ZettelEvidenceRef = {
  path: string;
  pointer?: string;
  digest?: string;
};

export type Zettel = {
  id: string;
  createdAt: string;
  title: string;
  kind: ZettelKind;
  body: string;
  tags?: string[];
  evidence?: ZettelEvidenceRef[];
};

export type ZettelLink = {
  id: string;
  createdAt: string;
  sourceZettelId: string;
  targetZettelId: string;
  relation: ZettelLinkRelation;
  rationale?: string;
};
