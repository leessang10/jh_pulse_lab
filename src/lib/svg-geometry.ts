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
