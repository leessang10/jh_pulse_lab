import { describe, expect, it } from "vitest";
import {
  getLandingDetailCenterPanelClassName,
  getLandingDetailCardinalTimeLabels,
  getLandingDetailHourMarkers,
  getLandingDetailReservationBlockBorder,
  getLandingDetailReservationLabelClassName,
  getLandingDetailScheduleGeometry,
  getLandingDetailSectorAngles,
} from "./landing-detail-schedule";

describe("landing detail schedule layout", () => {
  it("uses a smaller inner circle so reservation blocks read as larger sectors", () => {
    expect(getLandingDetailScheduleGeometry()).toEqual({
      reservationBlockWidth: 108,
      reservationInnerRadius: 58,
      reservationLabelRadius: 112,
      reservationOuterRadius: 166,
    });
  });

  it("shrinks the center panel to match the smaller inner radius", () => {
    expect(getLandingDetailCenterPanelClassName()).toContain("inset-[34%]");
    expect(getLandingDetailCenterPanelClassName()).toContain("p-2");
  });

  it("builds inner tick marks at one-hour and half-hour intervals", () => {
    const markers = getLandingDetailHourMarkers();

    expect(markers).toHaveLength(48);
    expect(markers[0]).toEqual({
      angleDegrees: 0,
      index: 0,
      innerRadius: 146,
      kind: "hour",
      outerRadius: 166,
      strokeWidth: 2,
    });
    expect(markers[1]).toEqual({
      angleDegrees: 7.5,
      index: 1,
      innerRadius: 157,
      kind: "halfHour",
      outerRadius: 166,
      strokeWidth: 1.3,
    });
    expect(markers[2]).toMatchObject({
      angleDegrees: 15,
      kind: "hour",
    });
  });

  it("shows only four small cardinal time labels outside the outer circle", () => {
    expect(getLandingDetailCardinalTimeLabels()).toEqual([
      { angleDegrees: 0, label: "00", radius: 178 },
      { angleDegrees: 90, label: "06", radius: 178 },
      { angleDegrees: 180, label: "12", radius: 178 },
      { angleDegrees: 270, label: "18", radius: 178 },
    ]);
  });

  it("uses transparent reservation labels without a visible box", () => {
    const className = getLandingDetailReservationLabelClassName();

    expect(className).toContain("bg-transparent");
    expect(className).toContain("border-0");
    expect(className).toContain("shadow-none");
    expect(className).toContain("text-foreground");
    expect(className).toContain("255_255_255");
    expect(className).not.toContain("rounded-md");
  });

  it("adds a crisp border around reservation blocks", () => {
    expect(getLandingDetailReservationBlockBorder()).toEqual({
      stroke: "#000000",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2.5,
      vectorEffect: "non-scaling-stroke",
    });
  });

  it("aligns reservation sector edges to the same half-hour grid as tick marks", () => {
    expect(getLandingDetailSectorAngles({ startMinutes: 60, endMinutes: 180 })).toEqual({
      endAngleDegrees: 45,
      startAngleDegrees: 15,
    });
  });
});
