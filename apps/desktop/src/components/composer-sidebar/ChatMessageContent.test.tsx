/**
 * Tests ChatMessageContent - rendu markdown + HTML + SVG complet.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessageContent } from "./ChatMessageContent.js";

describe("ChatMessageContent", () => {
  it("rend un paragraphe markdown simple", () => {
    render(<ChatMessageContent content="Bonjour **Tom**" />);
    expect(screen.getByText("Tom").tagName).toBe("STRONG");
  });

  it("rend un titre h2", () => {
    render(<ChatMessageContent content="## Mon titre" />);
    expect(screen.getByRole("heading", { level: 2, name: "Mon titre" })).toBeInTheDocument();
  });

  it("rend un tableau GFM avec headers et cellules", () => {
    const md = `
| Col A | Col B |
|-------|-------|
| 1     | 2     |
| 3     | 4     |
`;
    render(<ChatMessageContent content={md} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Col A" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
  });

  it("rend un code block avec la langue", () => {
    const md = "```js\nconst x = 1;\n```";
    const { container } = render(<ChatMessageContent content={md} />);
    // rehype-highlight ajoute la classe hljs + language-* sur le <code> ; on
    // teste le plus robuste : le <pre> est present et contient un <code>.
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre?.querySelector("code")).toBeTruthy();
  });

  it("rend du code inline", () => {
    render(<ChatMessageContent content="use `foo` bar" />);
    expect(screen.getByText("foo").tagName).toBe("CODE");
  });

  it("rend un blockquote", () => {
    render(<ChatMessageContent content="> quote" />);
    expect(screen.getByText("quote")).toBeInTheDocument();
    const bq = screen.getByText("quote").closest("blockquote");
    expect(bq).toBeTruthy();
  });

  it("rend un lien externe avec target blank", () => {
    render(<ChatMessageContent content="[AlphaLuppi](https://alphaluppi.com)" />);
    const link = screen.getByRole("link", { name: "AlphaLuppi" });
    expect(link).toHaveAttribute("href", "https://alphaluppi.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("rend un SVG inline sans le stripper", () => {
    const svg = '<svg width="10" height="10"><circle cx="5" cy="5" r="4"/></svg>';
    const { container } = render(<ChatMessageContent content={svg} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("svg circle")).toBeTruthy();
  });

  it("bloque une balise script (XSS protection)", () => {
    const md = "<script>window.hacked=true</script>ok";
    const { container } = render(<ChatMessageContent content={md} />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("bloque un handler on* (XSS protection)", () => {
    const md = '<p onclick="alert(1)">click</p>';
    const { container } = render(<ChatMessageContent content={md} />);
    const p = container.querySelector("p");
    expect(p?.getAttribute("onclick")).toBeNull();
  });

  it("rend une liste a puces", () => {
    const md = `
- item1
- item2
`;
    render(<ChatMessageContent content={md} />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("UL");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
