export const overseasDiscoveryErrorCodes = [
  "OVERSEAS_DISCOVERY_INPUT_INVALID",
  "OVERSEAS_DISCOVERY_QUERY_FILE_UNREADABLE",
  "OVERSEAS_DISCOVERY_QUERY_FILE_TOO_LARGE",
  "OVERSEAS_DISCOVERY_QUERY_FILE_INVALID",
  "OVERSEAS_DISCOVERY_PROVIDER_UNAVAILABLE",
] as const;

export type OverseasDiscoveryErrorCode =
  (typeof overseasDiscoveryErrorCodes)[number];

export class OverseasDiscoveryError extends Error {
  readonly name = "OverseasDiscoveryError";

  constructor(
    readonly code: OverseasDiscoveryErrorCode,
    message: string,
    readonly issuePaths: readonly string[] = [],
  ) {
    super(message);
  }
}
