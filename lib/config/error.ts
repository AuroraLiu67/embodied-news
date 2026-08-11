import type { z } from "zod";

export class ConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(error: z.ZodError) {
    const issues = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "config";
      return `${path}: ${issue.message}`;
    });
    super(`配置无效：${issues.join("；")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}
