import { describe, expect, it } from "vitest";
import { getStableAnnularSectorPath, getStableCirclePoint, toStableSvgCoordinate } from "./svg-geometry";

describe("svg geometry", () => {
  it("rounds SVG coordinates to stable decimals for hydration", () => {
    expect(toStableSvgCoordinate(58.756443470178624)).toBe(58.76);
    expect(toStableSvgCoordinate(50.096189432334256)).toBe(50.1);
  });

  it("returns stable circle points for server and browser SVG attributes", () => {
    expect(getStableCirclePoint(345, 140, 180)).toEqual({
      x: 143.77,
      y: 44.77,
    });
  });

  it("builds stable annular sector paths for filled reservation blocks", () => {
    expect(
      getStableAnnularSectorPath({
        center: 180,
        endAngleDegrees: 45,
        innerRadius: 78,
        outerRadius: 130,
        startAngleDegrees: 15,
      }),
    ).toBe("M 213.65 54.43 A 130 130 0 0 1 271.92 88.08 L 235.15 124.85 A 78 78 0 0 0 200.19 104.66 Z");
  });
});
