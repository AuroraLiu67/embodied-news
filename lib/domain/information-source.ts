import type {
  HttpUrl,
  InformationSourceId,
  IsoDateTime,
  SourceTier,
  SourceType,
} from "./common";

export interface InformationSource {
  sourceId: InformationSourceId;
  title: string;
  url: HttpUrl;
  publisher: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  publishedAt: IsoDateTime | null;
  isPrimary: boolean;
  lastVerifiedAt: IsoDateTime | null;
}
