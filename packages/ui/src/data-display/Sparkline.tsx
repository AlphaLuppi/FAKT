import { tokens } from "@fakt/design-tokens";
import type { ReactElement } from "react";

export interface SparklineProps {
  data: ReadonlyArray<number>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  ariaLabel?: string;
}

/** Mini graphique polyline, sans blur ni gradient. */
export function Sparkline({
  data,
  width = 100,
  height = 28,
  stroke,
  fill,
  ariaLabel,
}: SparklineProps): ReactElement {
  if (data.length === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label={ariaLabel ?? "Graphique vide"} />
    );
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(" ");

  const inkStroke = stroke ?? tokens.color.ink;

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? "Tendance"}
      style={{ overflow: "visible" }}
    >
      {fill !== undefined && (
        <polyline fill={fill} stroke="none" points={`0,${height} ${pts} ${width},${height}`} />
      )}
      <polyline
        fill="none"
        stroke={inkStroke}
        strokeWidth={2}
        points={pts}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
