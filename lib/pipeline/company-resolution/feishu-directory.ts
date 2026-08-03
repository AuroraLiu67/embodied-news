import type { Company } from "../../domain";
import type { CompanyDirectory } from "./types";

interface CompanyRepositoryView {
  list(): Promise<readonly { data: Company }[]>;
}

export class FeishuCompanyDirectory implements CompanyDirectory {
  constructor(
    private readonly repository: CompanyRepositoryView,
  ) {}

  async listCompanies() {
    return (await this.repository.list()).map((record) => record.data);
  }
}
