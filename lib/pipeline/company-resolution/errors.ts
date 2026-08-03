export const companyResolutionErrorCodes = [
  "COMPANY_RESOLUTION_INPUT_INVALID",
  "COMPANY_DIRECTORY_INVALID",
] as const;

export type CompanyResolutionErrorCode =
  (typeof companyResolutionErrorCodes)[number];

export class CompanyResolutionError extends Error {
  readonly name = "CompanyResolutionError";

  constructor(
    readonly code: CompanyResolutionErrorCode,
    message: string,
  ) {
    super(message);
  }
}
