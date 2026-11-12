import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as planModule from "../netlify/functions/plan";
import * as replanModule from "../netlify/functions/replan";

describe("Netlify Functions layout", () => {
  it("keeps test files out of the deploy entry directory", () => {
    const functionsRoot = resolve(process.cwd(), "netlify/functions");
    const rootTestFiles = readdirSync(functionsRoot).filter((name) => /\.test\.tsx?$/.test(name));

    expect(rootTestFiles).toEqual([]);
  });

  it.each([
    ["plan", planModule],
    ["replan", replanModule],
  ])("uses only the modern default export for %s", (_name, module) => {
    expect(module).toHaveProperty("default");
    expect(module).not.toHaveProperty("handler");
  });
});
