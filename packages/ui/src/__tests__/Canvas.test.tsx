import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { Canvas, type CanvasHandle } from "../specialized/Canvas.js";

describe("Canvas", () => {
  it("rend un élément canvas avec dimensions", () => {
    const { container } = render(<Canvas width={300} height={100} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(300);
    expect(canvas?.height).toBe(100);
  });

  it("expose clear/toDataURL/isEmpty via ref", () => {
    const ref = createRef<CanvasHandle>();
    render(<Canvas ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.clear).toBe("function");
    expect(typeof ref.current?.toDataURL).toBe("function");
    expect(ref.current?.isEmpty()).toBe(true);
  });
});
