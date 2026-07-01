import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readGlobalsCss() {
  return readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
}

function readLandingPage() {
  return readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
}

function getRootCssVariable(css: string, name: string) {
  const rootBlock = css.match(/:root\s*\{(?<body>[\s\S]*?)\n\}/)?.groups?.body;
  const value = rootBlock?.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

  return value;
}

describe("landing visual tokens", () => {
  it("uses a softer mint sage and apricot circular schedule palette", () => {
    const css = readGlobalsCss();

    expect(getRootCssVariable(css, "--reservation-accent")).toBe("#2fa889");
    expect(getRootCssVariable(css, "--reservation-accent-soft")).toBe("#e8f2ec");
    expect(getRootCssVariable(css, "--reservation-segment-1")).toBe("#3f9f89");
    expect(getRootCssVariable(css, "--reservation-segment-2")).toBe("#52aa91");
    expect(getRootCssVariable(css, "--reservation-segment-3")).toBe("#82bca9");
    expect(getRootCssVariable(css, "--reservation-segment-4")).toBe("#a6cbbb");
    expect(getRootCssVariable(css, "--reservation-segment-5")).toBe("#e9a17f");
    expect(getRootCssVariable(css, "--reservation-segment-6")).toBe("#f0c37b");
  });

  it("uses the soft reservation tone for the landing detail summary badge", () => {
    expect(readLandingPage()).toContain("bg-reservation-accent-soft/65");
  });

  it("keeps the landing detail summary badge at a fixed width", () => {
    expect(readLandingPage()).toContain("w-[5.5rem]");
  });
});
