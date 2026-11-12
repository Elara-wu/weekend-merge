import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Netlify Functions layout", () => {
  it("keeps test files out of the deploy entry directory", () => {
    const functionsRoot = resolve(process.cwd(), "netlify/functions");
    const rootTestFiles = readdirSync(functionsRoot).filter((name) => /\.test\.tsx?$/.test(name));

    expect(rootTestFiles).toEqual([]);
  });
});
