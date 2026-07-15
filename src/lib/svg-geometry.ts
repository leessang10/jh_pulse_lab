export function toStableSvgCoordinate(value: number) {
  return Number(value.toFixed(2));
}

export function getStableCirclePoint(angleDegrees: number, radius: number, center: number) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;

  return {
    x: toStableSvgCoordinate(center + radius * Math.cos(radians)),
    y: toStableSvgCoordinate(center + radius * Math.sin(radians)),
  };
}

export function getStableAnnularSectorPath({
  center,
  endAngleDegrees,
  innerRadius,
  outerRadius,
  startAngleDegrees,
}: {
  center: number;
  endAngleDegrees: number;
  innerRadius: number;
  outerRadius: number;
  startAngleDegrees: number;
}) {
  if (endAngleDegrees - startAngleDegrees >= 360) {
    const outerStart = getStableCirclePoint(startAngleDegrees, outerRadius, center);
    const outerMiddle = getStableCirclePoint(startAngleDegrees + 180, outerRadius, center);
    const outerEnd = getStableCirclePoint(startAngleDegrees + 360, outerRadius, center);
    const innerEnd = getStableCirclePoint(startAngleDegrees + 360, innerRadius, center);
    const innerMiddle = getStableCirclePoint(startAngleDegrees + 180, innerRadius, center);
    const innerStart = getStableCirclePoint(startAngleDegrees, innerRadius, center);

    return [
      `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${outerMiddle.x.toFixed(2)} ${outerMiddle.y.toFixed(2)}`,
      `A ${outerRadius} ${outerRadius} 0 0 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
      `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${innerMiddle.x.toFixed(2)} ${innerMiddle.y.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  const largeArcFlag = endAngleDegrees - startAngleDegrees > 180 ? 1 : 0;
  const outerStart = getStableCirclePoint(startAngleDegrees, outerRadius, center);
  const outerEnd = getStableCirclePoint(endAngleDegrees, outerRadius, center);
  const innerEnd = getStableCirclePoint(endAngleDegrees, innerRadius, center);
  const innerStart = getStableCirclePoint(startAngleDegrees, innerRadius, center);

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}
