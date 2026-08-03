import { describe, expect, it } from "vitest";

import { openAIResearchJsonSchema } from "../../../lib/providers/openai/response-schema";

type JsonSchemaNode = {
  type?: string | readonly string[];
  properties?: Record<string, JsonSchemaNode>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  anyOf?: readonly JsonSchemaNode[];
};

const collectObjectContractProblems = (
  node: JsonSchemaNode,
  path = "$",
): string[] => {
  const problems: string[] = [];
  if (node.type === "object") {
    const propertyNames = Object.keys(node.properties ?? {}).sort();
    const requiredNames = [...(node.required ?? [])].sort();
    if (node.additionalProperties !== false) {
      problems.push(`${path} must set additionalProperties=false`);
    }
    if (JSON.stringify(propertyNames) !== JSON.stringify(requiredNames)) {
      problems.push(`${path} must require every property`);
    }
  }
  for (const [name, child] of Object.entries(node.properties ?? {})) {
    problems.push(...collectObjectContractProblems(child, `${path}.${name}`));
  }
  if (node.items) {
    problems.push(...collectObjectContractProblems(node.items, `${path}[]`));
  }
  for (const [index, child] of (node.anyOf ?? []).entries()) {
    problems.push(...collectObjectContractProblems(child, `${path}.anyOf[${index}]`));
  }
  return problems;
};

describe("OpenAI strict JSON Schema", () => {
  it("requires every declared field and forbids unknown fields at every object", () => {
    expect(collectObjectContractProblems(openAIResearchJsonSchema)).toEqual([]);
  });

  it("requires structured conflicts in the model response", () => {
    expect(openAIResearchJsonSchema.required).toContain("conflicts");
    expect(openAIResearchJsonSchema.properties.conflicts.items.properties.values.minItems).toBe(2);
  });
});
