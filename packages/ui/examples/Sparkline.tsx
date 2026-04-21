import type { ReactElement } from "react";
import { Sparkline } from "../src/data-display/Sparkline.js";

export function SparklineExample(): ReactElement {
  return (
    <div style={{ padding: 24, display: "flex", gap: 24, alignItems: "center" }}>
      <Sparkline data={[8, 12, 10, 14, 11, 17]} />
      <Sparkline data={[1, 2, 3, 2, 3, 3]} width={80} height={20} />
      <Sparkline data={[62, 65, 68, 70, 72, 74]} width={120} height={32} />
    </div>
  );
}
