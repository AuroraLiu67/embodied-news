import { z } from "zod";

import { ConfigurationError } from "./error";

export type ConfigSource = Readonly<Record<string, string | undefined>>;

const siteBasePathSchema = z
  .string()
  .max(100)
  .refine(
    (value) => value === "" || /^\/[a-zA-Z0-9._-]+$/.test(value),
    "必须为空或形如 /repository-name，且末尾不能有斜杠",
  );

const publicConfigSchema = z
  .object({
    siteBasePath: siteBasePathSchema,
  })
  .strict();

export interface PublicConfig {
  siteBasePath: string;
}

export const loadPublicConfig = (source: ConfigSource = process.env): PublicConfig => {
  const result = publicConfigSchema.safeParse({
    siteBasePath: source.NEXT_PUBLIC_SITE_BASE_PATH ?? "",
  });

  if (!result.success) {
    throw new ConfigurationError(result.error);
  }

  return result.data;
};
