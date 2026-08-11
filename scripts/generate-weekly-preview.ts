import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {
  generateWeeklyPreviewProjection,
  MAX_WEEKLY_PREVIEW_FILE_BYTES,
  parseWeeklyEnrichment,
  serializeWeeklyPreviewProjection,
} from "../lib/pipeline/weekly-preview-projection";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = args[0];
  const outputIndex = args.indexOf("--output");
  const startIndex = args.indexOf("--week-start");
  const endIndex = args.indexOf("--week-end");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const weekStart = startIndex >= 0 ? args[startIndex + 1] : undefined;
  const weekEnd = endIndex >= 0 ? args[endIndex + 1] : undefined;
  if (!inputPath || !outputPath || !weekStart || !weekEnd) {
    throw new Error("用法: generate-weekly-preview <enrichment.json> --week-start YYYY-MM-DD --week-end YYYY-MM-DD --output <path>");
  }
  if (resolve(inputPath) === resolve(outputPath)) throw new Error("输出不得覆盖输入文件");
  const metadata = await stat(inputPath);
  if (!metadata.isFile() || metadata.size > MAX_WEEKLY_PREVIEW_FILE_BYTES) throw new Error("输入必须是小于或等于5 MiB的普通文件");
  const content = await readFile(inputPath, "utf8");
  const input = parseWeeklyEnrichment(JSON.parse(content) as unknown, Buffer.byteLength(content));
  const projection = generateWeeklyPreviewProjection(input, weekStart, weekEnd);
  await mkdir(dirname(outputPath), {recursive: true});
  await writeFile(outputPath, serializeWeeklyPreviewProjection(projection), "utf8");
  process.stdout.write(`${JSON.stringify({mode: projection.mode, output: outputPath, counts: projection.counts})}\n`);
}

void main();
