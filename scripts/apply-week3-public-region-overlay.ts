import {readFile, writeFile} from "node:fs/promises";

import {z} from "zod";

import {serializeWeeklyPreviewProjection, weeklyPreviewProjectionSchema} from "../lib/pipeline/weekly-preview-projection";

const projectionPath = "public/data/weekly/2026-08-17.json";
const auditPath = "docs/pilot/2026-08-17-to-23-candidate-preparation.json";

const auditSchema = z.object({
  events: z.array(z.object({
    eventKey: z.string().min(1),
    regionScope: z.enum(["CHINA", "OVERSEAS"]),
  }).passthrough()).length(68),
}).passthrough();

async function main(): Promise<void> {
  const [projection, audit] = await Promise.all([
    readFile(projectionPath, "utf8").then((text) => weeklyPreviewProjectionSchema.parse(JSON.parse(text))),
    readFile(auditPath, "utf8").then((text) => auditSchema.parse(JSON.parse(text))),
  ]);
  const regions = new Map(audit.events.map((event) => [event.eventKey, event.regionScope]));
  const events = projection.events.map((event) => {
    const regionScope = regions.get(event.id);
    if (!regionScope) throw new Error(`缺少已审核地域: ${event.id}`);
    return {...event, regionScope};
  });
  if (regions.size !== events.length) throw new Error("地域overlay与公开事件数量不一致");
  const updated = weeklyPreviewProjectionSchema.parse({...projection, events});
  await writeFile(projectionPath, serializeWeeklyPreviewProjection(updated), "utf8");
  process.stdout.write(`${JSON.stringify({events: events.length, china: events.filter((event) => event.regionScope === "CHINA").length, overseas: events.filter((event) => event.regionScope === "OVERSEAS").length})}\n`);
}

void main();
