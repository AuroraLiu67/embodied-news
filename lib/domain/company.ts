import type { CompanyId, HttpUrl } from "./common";

export interface Company {
  companyId: CompanyId;
  nameZh: string | null;
  nameEn: string | null;
  aliases: readonly string[];
  website: HttpUrl;
  region: string;
  technologyTags: readonly string[];
  publicDescription: string;
}
