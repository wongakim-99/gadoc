import { parseDocument } from "htmlparser2";
import { Lexer, type Token } from "marked";

export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  href?: string;
};
export type ReadBlock = {
  kind:
    | "paragraph"
    | "heading"
    | "code"
    | "quote"
    | "list"
    | "divider"
    | "notice"
    | "table";
  spans: Span[];
  level?: number;
  depth?: number;
  prefix?: string;
  rows?: Span[][][];
};
export type ReadResult = { blocks: ReadBlock[]; truncated: boolean };
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const MAX_CONTENT = 500_000;
const MAX_BLOCKS = 1200;
const MAX_DEPTH = 12;

export function safeLink(href: string): string | undefined {
  if (/\s|[\u0000-\u001f\u007f]/.test(href)) return;
  try {
    const url = new URL(href);
    if (url.username || url.password) return;
    if (
      url.protocol === "https:" ||
      url.protocol === "http:" ||
      url.protocol === "mailto:"
    )
      return url.href;
  } catch {
    /* Only explicitly absolute, safe protocols are navigable. */
  }
}

function inlineMarkdown(
  tokens: Token[],
  depth = 0,
  style: Omit<Span, "text"> = {},
): Span[] {
  if (depth > MAX_DEPTH) return [];
  return tokens.flatMap((token): Span[] => {
    switch (token.type) {
      case "strong":
        return inlineMarkdown(token.tokens ?? [], depth + 1, {
          ...style,
          bold: true,
        });
      case "em":
        return inlineMarkdown(token.tokens ?? [], depth + 1, {
          ...style,
          italic: true,
        });
      case "del":
        return inlineMarkdown(token.tokens ?? [], depth + 1, {
          ...style,
          strike: true,
        });
      case "link":
        return inlineMarkdown(token.tokens ?? [], depth + 1, {
          ...style,
          href: safeLink(token.href),
        });
      case "image":
        return [
          {
            text: `[이미지: ${token.text || "이미지"}]`,
            href: safeLink(token.href),
          },
        ];
      case "codespan":
        return [{ text: token.text, ...style, code: true }];
      case "br":
        return [{ text: "\n" }];
      case "html":
        return []; // Raw Markdown HTML is never executed or interpreted.
      default:
        return "tokens" in token && token.tokens
          ? inlineMarkdown(token.tokens, depth + 1, style)
          : [{ text: "text" in token ? (token.text ?? "") : "", ...style }];
    }
  });
}

function markdownBlocks(tokens: Token[], depth = 0): ReadBlock[] {
  if (depth > MAX_DEPTH) return [];
  const result: ReadBlock[] = [];
  for (const token of tokens.slice(0, MAX_BLOCKS)) {
    if (result.length >= MAX_BLOCKS) break;
    switch (token.type) {
      case "space":
      case "def":
      case "html":
      case "checkbox":
        break;
      case "heading":
        result.push({
          kind: "heading",
          level: token.depth,
          spans: inlineMarkdown(token.tokens ?? []),
        });
        break;
      case "code":
        result.push({ kind: "code", spans: [{ text: token.text }] });
        break;
      case "hr":
        result.push({ kind: "divider", spans: [] });
        break;
      case "blockquote":
        result.push(
          ...markdownBlocks(token.tokens ?? [], depth + 1).map((block) => ({
            ...block,
            kind: "quote" as const,
          })),
        );
        break;
      case "list": {
        token.items.forEach(
          (
            item: { task: boolean; checked?: boolean; tokens: Token[] },
            index: number,
          ) => {
            const children = markdownBlocks(item.tokens, depth + 1);
            children.forEach((block, childIndex) =>
              result.push({
                ...block,
                kind: "list",
                depth,
                prefix: childIndex
                  ? ""
                  : item.task
                    ? item.checked
                      ? "☑"
                      : "☐"
                    : token.ordered
                      ? `${Number(token.start || 1) + index}.`
                      : "•",
              }),
            );
          },
        );
        break;
      }
      case "table":
        result.push({
          kind: "table",
          spans: [],
          rows: [token.header, ...token.rows].map(
            (row: { tokens: Token[] }[]) =>
              row.map((cell) => inlineMarkdown(cell.tokens)),
          ),
        });
        break;
      default:
        result.push({
          kind: "paragraph",
          spans: inlineMarkdown(
            ("tokens" in token ? token.tokens : undefined) ?? [
              {
                type: "text",
                raw: token.raw,
                text: "text" in token ? (token.text ?? "") : "",
              },
            ],
          ),
        });
    }
  }
  return result;
}

type HtmlNode = ReturnType<typeof parseDocument>["children"][number];
const blocked = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "form",
  "button",
  "video",
  "audio",
  "canvas",
  "noscript",
]);
const htmlChildren = (node: HtmlNode): HtmlNode[] =>
  "children" in node ? node.children : [];
const tag = (node: HtmlNode) => ("name" in node ? node.name.toLowerCase() : "");
function htmlInline(
  nodes: HtmlNode[],
  depth = 0,
  style: Omit<Span, "text"> = {},
): Span[] {
  if (depth > MAX_DEPTH) return [];
  return nodes.flatMap((node): Span[] => {
    if (node.type === "text") return [{ text: node.data, ...style }];
    const name = tag(node);
    if (
      blocked.has(name) ||
      !("attribs" in node) ||
      node.attribs.hidden !== undefined ||
      node.attribs["aria-hidden"] === "true"
    )
      return [];
    if (name === "br") return [{ text: "\n" }];
    if (name === "img")
      return [
        {
          text: `[이미지: ${node.attribs.alt || "이미지"}]`,
          href: safeLink(node.attribs.src ?? ""),
        },
      ];
    if (name === "input")
      return node.attribs.type === "checkbox"
        ? [{ text: node.attribs.checked === undefined ? "☐ " : "☑ " }]
        : [];
    return htmlInline(htmlChildren(node), depth + 1, {
      ...style,
      bold: style.bold || name === "strong" || name === "b",
      italic: style.italic || name === "em" || name === "i",
      code: style.code || name === "code",
      strike: style.strike || name === "del" || name === "s",
      href: name === "a" ? safeLink(node.attribs.href ?? "") : style.href,
    });
  });
}
function htmlBlocks(nodes: HtmlNode[], depth = 0): ReadBlock[] {
  if (depth > MAX_DEPTH) return [];
  const result: ReadBlock[] = [];
  let inline: HtmlNode[] = [];
  const flush = () => {
    const spans = htmlInline(inline);
    if (spans.some((span) => span.text.trim()))
      result.push({ kind: "paragraph", spans });
    inline = [];
  };
  for (const node of nodes.slice(0, MAX_BLOCKS)) {
    if (result.length >= MAX_BLOCKS) break;
    const name = tag(node);
    if (blocked.has(name)) continue;
    const children = htmlChildren(node);
    if (
      /^(p|h[1-6]|pre|blockquote|li|hr|table|ul|ol|div|section|article|details|summary)$/.test(
        name,
      )
    ) {
      flush();
      if (name === "table") {
        const rows: Span[][][] = [];
        const visitRows = (items: HtmlNode[], level: number) => {
          if (level > MAX_DEPTH) return;
          for (const item of items.slice(0, MAX_BLOCKS)) {
            if (tag(item) === "tr")
              rows.push(
                htmlChildren(item)
                  .filter((cell) => ["td", "th"].includes(tag(cell)))
                  .map((cell) => htmlInline(htmlChildren(cell))),
              );
            else visitRows(htmlChildren(item), level + 1);
          }
        };
        visitRows(children, 0);
        result.push({ kind: "table", spans: [], rows });
      } else if (name === "ul" || name === "ol") {
        children
          .filter((item) => tag(item) === "li")
          .forEach((item, index) => {
            result.push({
              kind: "list",
              spans: htmlInline(htmlChildren(item)),
              depth,
              prefix: name === "ol" ? `${index + 1}.` : "•",
            });
          });
      } else if (["div", "section", "article", "details"].includes(name))
        result.push(...htmlBlocks(children, depth + 1));
      else
        result.push({
          kind: /^h[1-6]$/.test(name)
            ? "heading"
            : name === "pre"
              ? "code"
              : name === "blockquote"
                ? "quote"
                : name === "hr"
                  ? "divider"
                  : "paragraph",
          level: Number(name[1]) || undefined,
          spans: htmlInline(children),
        });
    } else inline.push(node);
  }
  flush();
  return result;
}

function jsonInline(value: unknown, depth = 0): Span[] {
  if (depth > MAX_DEPTH) return [];
  if (typeof value === "string") return [{ text: value }];
  if (Array.isArray(value))
    return value
      .slice(0, MAX_BLOCKS)
      .flatMap((item) => jsonInline(item, depth + 1));
  const item = record(value);
  if (item.type === "link")
    return jsonInline(item.content, depth + 1).map((span) => ({
      ...span,
      href: safeLink(text(item.href)),
    }));
  const style = record(item.styles);
  return [
    {
      text: text(item.text),
      bold: style.bold === true,
      italic: style.italic === true,
      code: style.code === true,
      strike: style.strike === true,
    },
  ];
}
function jsonBlocks(value: unknown, depth = 0): ReadBlock[] {
  if (!Array.isArray(value)) return [];
  if (depth > MAX_DEPTH)
    return [
      {
        kind: "notice",
        spans: [{ text: "깊게 중첩된 블록은 웹에서 확인해 주세요." }],
      },
    ];
  const result: ReadBlock[] = [];
  value.slice(0, MAX_BLOCKS).forEach((input) => {
    const block = record(input);
    const props = record(block.props);
    const type = text(block.type);
    const spans = jsonInline(block.content);
    if (type === "documentColumns" || type === "documentColumn") {
      result.push(...jsonBlocks(block.children, depth + 1));
      return;
    }
    if (type === "divider") result.push({ kind: "divider", spans: [] });
    else if (type === "database")
      result.push({
        kind: "notice",
        spans: [{ text: "연결된 데이터베이스는 웹에서 확인해 주세요." }],
      });
    else if (["image", "file", "video", "audio"].includes(type))
      result.push({
        kind: "paragraph",
        spans: [
          {
            text: `[첨부: ${text(props.name) || text(props.caption) || type}]`,
            href: safeLink(text(props.url)),
          },
        ],
      });
    else if (type === "table") {
      const rows = record(block.content).rows;
      result.push({
        kind: "table",
        spans: [],
        rows: Array.isArray(rows)
          ? rows.slice(0, MAX_BLOCKS).map((row) => {
              const cells = record(row).cells;
              return Array.isArray(cells)
                ? cells.map((cell) =>
                    jsonInline(
                      Array.isArray(cell) ? cell : record(cell).content,
                    ),
                  )
                : [];
            })
          : [],
      });
    } else if (
      [
        "paragraph",
        "heading",
        "bulletListItem",
        "numberedListItem",
        "checkListItem",
        "codeBlock",
        "quote",
        "toggleListItem",
      ].includes(type)
    ) {
      result.push({
        kind:
          type === "heading"
            ? "heading"
            : type === "codeBlock"
              ? "code"
              : type === "quote"
                ? "quote"
                : /ListItem$/.test(type)
                  ? "list"
                  : "paragraph",
        spans,
        level: Number(props.level) || 1,
        depth,
        prefix:
          type === "checkListItem"
            ? props.checked
              ? "☑"
              : "☐"
            : type === "numberedListItem"
              ? `${Number(props.start) || 1}.`
              : "•",
      });
    } else
      result.push({
        kind: "notice",
        spans: [{ text: "이 블록은 웹에서 확인해 주세요." }, ...spans],
      });
    result.push(...jsonBlocks(block.children, depth + 1));
  });
  return result;
}

export function parseContent(
  content: string,
  format: "plain" | "html" | "json" = "plain",
): ReadResult {
  const truncated = content.length > MAX_CONTENT;
  // Never parse incomplete JSON as raw text: it can expose implementation/hidden fields.
  if (truncated && format === "json")
    return {
      blocks: [
        {
          kind: "notice",
          spans: [{ text: "큰 문서는 웹에서 확인해 주세요." }],
        },
      ],
      truncated: true,
    };
  const bounded = content.slice(0, MAX_CONTENT);
  try {
    const blocks =
      format === "json"
        ? jsonBlocks(JSON.parse(bounded))
        : format === "html"
          ? htmlBlocks(
              parseDocument(bounded, { decodeEntities: true }).children,
            )
          : markdownBlocks(Lexer.lex(bounded, { gfm: true }));
    return {
      blocks: blocks.slice(0, MAX_BLOCKS),
      truncated: truncated || blocks.length >= MAX_BLOCKS,
    };
  } catch {
    return {
      blocks: [
        {
          kind: "notice",
          spans: [
            { text: "본문을 표시하지 못했습니다. 웹에서 확인해 주세요." },
          ],
        },
      ],
      truncated: false,
    };
  }
}
