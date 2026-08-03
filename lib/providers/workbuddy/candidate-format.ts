import { z } from "zod";

import { workBuddyCandidateInputSchema } from "../../domain/schemas/boundaries";

export const workBuddyCandidateFormatVersion = "1" as const;
export const maximumWorkBuddyCandidatesPerFile = 500;

export const workBuddyCandidateFileSchema = z
  .object({
    schemaVersion: z.literal(workBuddyCandidateFormatVersion),
    candidates: z
      .array(workBuddyCandidateInputSchema)
      .min(1)
      .max(maximumWorkBuddyCandidatesPerFile),
  })
  .strict();

export type WorkBuddyCandidateInput = z.infer<
  typeof workBuddyCandidateInputSchema
>;

export type WorkBuddyCandidateFile = z.infer<
  typeof workBuddyCandidateFileSchema
>;
