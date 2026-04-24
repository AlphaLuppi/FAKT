/**
 * ChatMessageContent - rendu markdown + HTML + SVG complet pour le Composer IA.
 *
 * Pipeline unifie autour de react-markdown :
 *   - remark-gfm     : tables, strikethrough, autolinks, task lists (GFM)
 *   - rehype-raw     : autorise le HTML brut inline (<svg>, <details>, etc.)
 *   - rehype-sanitize: filtre tags dangereux (<script>, <iframe>, <object>) en
 *     conservant le SVG (path, g, circle, rect, polygon, line, etc.).
 *   - rehype-highlight: coloration syntaxique des blocs ```lang```
 *
 * Design : tous les tags HTML / Markdown sont re-skinnes Brutal Invoice
 * (typo Space Grotesk UPPERCASE titres, JetBrains Mono code, borders 1.5-2px
 * noir, fond papier, zero radius).
 *
 * Securite : aucune execution JS permise (pas de <script>, pas de on-handlers).
 * Les SVG sont affiches en read-only - c'est voulu car le composer peut
 * recevoir des diagrammes generes par l'IA.
 */

import { tokens } from "@fakt/design-tokens";
import type { CSSProperties, ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

// --- Sanitize schema --------------------------------------------------------

/**
 * Whitelist SVG + HTML base, heritee de rehype-sanitize defaultSchema.
 * On ajoute explicitement les tags et attributs SVG car par defaut ils sont
 * stripes. On INTERDIT <script>, <iframe>, <object>, <embed>, <form>,
 * <input>, <button>, et toutes les handlers `on*`.
 */
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "svg",
    "path",
    "g",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
    "ellipse",
    "text",
    "tspan",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "mask",
    "pattern",
    "marker",
    "symbol",
    "use",
    "title",
    "desc",
    "details",
    "summary",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(((defaultSchema.attributes as Record<string, unknown>)?.["*"] as string[] | undefined) ??
        []),
      "className",
      "style",
    ],
    svg: [
      "width",
      "height",
      "viewBox",
      "xmlns",
      "fill",
      "stroke",
      "strokeWidth",
      "stroke-width",
      "class",
      "className",
      "style",
      "preserveAspectRatio",
    ],
    path: ["d", "fill", "stroke", "strokeWidth", "stroke-width", "opacity", "clipRule", "fillRule"],
    g: ["fill", "stroke", "transform", "opacity"],
    circle: ["cx", "cy", "r", "fill", "stroke"],
    rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke"],
    line: ["x1", "y1", "x2", "y2", "stroke", "strokeWidth"],
    polyline: ["points", "fill", "stroke"],
    polygon: ["points", "fill", "stroke"],
    ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke"],
    text: ["x", "y", "fill", "fontSize", "fontFamily", "textAnchor"],
    tspan: ["x", "y", "dx", "dy"],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    code: ["className"],
    pre: ["className"],
    table: ["className"],
    th: ["align"],
    td: ["align"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
    src: ["http", "https", "data"],
  },
};

// --- Styles Brutal Invoice ---------------------------------------------------

const { color, font, fontSize, fontWeight, stroke, spacing } = tokens;

const headingBase: CSSProperties = {
  fontFamily: font.ui,
  fontWeight: Number(fontWeight.black),
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: color.ink,
  margin: `${spacing[3]} 0 ${spacing[2]}`,
};

const inlineCodeStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: "0.9em",
  background: color.paper,
  border: `${stroke.hair} solid ${color.ink}`,
  padding: "1px 5px",
  color: color.ink,
};

const preStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: fontSize.xs,
  background: color.ink,
  color: color.surface,
  padding: spacing[3],
  border: `${stroke.base} solid ${color.ink}`,
  overflowX: "auto",
  margin: `${spacing[2]} 0`,
  lineHeight: 1.5,
};

const blockquoteStyle: CSSProperties = {
  borderLeft: `4px solid ${color.accentSoft}`,
  margin: `${spacing[2]} 0`,
  padding: `${spacing[1]} ${spacing[3]}`,
  fontStyle: "italic",
  color: color.ink3,
};

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
  margin: `${spacing[2]} 0`,
  border: `${stroke.base} solid ${color.ink}`,
  fontSize: fontSize.xs,
};

const thStyle: CSSProperties = {
  border: `${stroke.hair} solid ${color.ink}`,
  padding: `${spacing[1]} ${spacing[2]}`,
  background: color.ink,
  color: color.accentSoft,
  fontFamily: font.ui,
  fontWeight: Number(fontWeight.bold),
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  textAlign: "left",
};

const tdStyle: CSSProperties = {
  border: `${stroke.hair} solid ${color.ink}`,
  padding: `${spacing[1]} ${spacing[2]}`,
  fontFamily: font.ui,
  background: color.surface,
};

const linkStyle: CSSProperties = {
  color: color.ink,
  textDecoration: "underline",
  textDecorationThickness: "2px",
  textDecorationColor: color.accentSoft,
  textUnderlineOffset: "2px",
};

const components: Components = {
  h1: ({ children }) => <h1 style={{ ...headingBase, fontSize: fontSize.lg }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ ...headingBase, fontSize: fontSize.md }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ ...headingBase, fontSize: fontSize.sm }}>{children}</h3>,
  h4: ({ children }) => (
    <h4 style={{ ...headingBase, fontSize: fontSize.sm, letterSpacing: "0.04em" }}>{children}</h4>
  ),
  p: ({ children }) => (
    <p
      style={{
        fontFamily: font.ui,
        fontSize: fontSize.sm,
        lineHeight: 1.55,
        color: color.ink,
        margin: `${spacing[2]} 0`,
      }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        fontFamily: font.ui,
        fontSize: fontSize.sm,
        color: color.ink,
        paddingLeft: spacing[4],
        margin: `${spacing[2]} 0`,
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        fontFamily: font.ui,
        fontSize: fontSize.sm,
        color: color.ink,
        paddingLeft: spacing[4],
        margin: `${spacing[2]} 0`,
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-") === true;
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code style={inlineCodeStyle} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre style={preStyle}>{children}</pre>,
  blockquote: ({ children }) => <blockquote style={blockquoteStyle}>{children}</blockquote>,
  table: ({ children }) => <table style={tableStyle}>{children}</table>,
  th: ({ children }) => <th style={thStyle}>{children}</th>,
  td: ({ children }) => <td style={tdStyle}>{children}</td>,
  hr: () => (
    <hr
      style={{
        border: 0,
        borderTop: `${stroke.base} solid ${color.ink}`,
        margin: `${spacing[3]} 0`,
      }}
    />
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ""}
      style={{ maxWidth: "100%", border: `${stroke.hair} solid ${color.ink}` }}
    />
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: Number(fontWeight.black) }}>{children}</strong>
  ),
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
};

// --- Composant --------------------------------------------------------------

interface ChatMessageContentProps {
  /** Le markdown / HTML / SVG a rendre. */
  content: string;
}

/**
 * Rend le contenu d'un bloc text d'un message assistant avec le pipeline
 * markdown complet. Reserve aux blocs `type:"text"` - les blocs thinking /
 * tool_use ont leur propre composant (cf. ThinkingBlock, ToolUseBlock).
 */
export function ChatMessageContent({ content }: ChatMessageContentProps): ReactElement {
  return (
    <div data-testid="chat-md" style={{ wordBreak: "break-word" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          [rehypeHighlight, { ignoreMissing: true, detect: true }],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
