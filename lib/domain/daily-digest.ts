import type {
  DigestId,
  DevelopmentId,
  EventId,
  IsoDate,
  IsoDateTime,
  PublicationStatus,
  ReviewStatus,
} from "./common";

export const digestSections = [
  "FUNDING",
  "TECHNOLOGY_PRODUCT",
  "COMMERCIALIZATION",
] as const;
export type DigestSection = (typeof digestSections)[number];

export interface DigestItemOrder {
  section: DigestSection;
  itemId: EventId | DevelopmentId;
  rank: number;
}

export interface DailyDigest {
  digestId: DigestId;
  digestDate: IsoDate;
  title: string;
  fundingEventIds: readonly EventId[];
  technologyProductDevelopmentIds: readonly DevelopmentId[];
  commercializationDevelopmentIds: readonly DevelopmentId[];
  sectionOrder: readonly DigestItemOrder[];
  marketObservation: string;
  reviewStatus: ReviewStatus;
  publicationStatus: PublicationStatus;
  publishedAt: IsoDateTime | null;
  autoPublished: boolean;
  correctionNote: string | null;
}

export interface DigestSortableItem {
  id: EventId | DevelopmentId;
  importanceScore: number;
}

export const sortDigestSection = <Item extends DigestSortableItem>(
  items: readonly Item[],
  manualOrder: readonly DigestItemOrder[],
  section: DigestSection,
): Item[] => {
  const ranks = new Map(
    manualOrder
      .filter((entry) => entry.section === section)
      .map((entry) => [entry.itemId, entry.rank]),
  );

  return [...items].sort((left, right) => {
    const leftRank = ranks.get(left.id);
    const rightRank = ranks.get(right.id);
    if (leftRank !== undefined || rightRank !== undefined) {
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    }
    return right.importanceScore - left.importanceScore;
  });
};
