import { parseContent, safeLink } from "../src/content/parse";
import { documentTree } from "../src/content/tree";
import { documentNode } from "./fixtures";

test("BlockNote headings, nested checklists, styles, code and table cells become native reading blocks", () => {
  const result = parseContent(
    JSON.stringify([
      {
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: "문서 제목", styles: { bold: true } }],
        children: [
          {
            type: "checkListItem",
            props: { checked: true },
            content: [{ type: "text", text: "할 일" }],
          },
        ],
      },
      {
        type: "table",
        content: { rows: [{ cells: [[{ type: "text", text: "셀" }]] }] },
      },
      {
        type: "codeBlock",
        content: [{ type: "text", text: "const test = 1;" }],
      },
    ]),
    "json",
  );
  expect(result.blocks[0]).toMatchObject({
    kind: "heading",
    level: 2,
    spans: [{ text: "문서 제목", bold: true }],
  });
  expect(result.blocks[1]).toMatchObject({
    kind: "list",
    prefix: "☑",
    depth: 1,
  });
  expect(result.blocks[2]?.rows?.[0]?.[0]?.[0]?.text).toBe("셀");
  expect(result.blocks[3]?.kind).toBe("code");
});

test("Markdown reading supports tasks, tables and safe links while omitting executable HTML", () => {
  const result = parseContent(
    "# 제목\n\n- [x] 완료\n\n| 항목 | 값 |\n| --- | --- |\n| 하나 | 둘 |\n\n[링크](https://example.test)\n\n<script>privateScript()</script>",
  );
  expect(result.blocks.some((block) => block.kind === "heading")).toBe(true);
  expect(result.blocks.some((block) => block.kind === "table")).toBe(true);
  expect(result.blocks.find((block) => block.kind === "list")).toMatchObject({
    prefix: "☑",
    spans: [{ text: "완료" }],
  });
  expect(JSON.stringify(result)).toContain("https://example.test/");
  expect(JSON.stringify(result)).not.toContain("privateScript");
});

test("current document column layout reads each visible column in order on mobile", () => {
  const result = parseContent(
    JSON.stringify([
      {
        type: "documentColumns",
        children: [
          {
            type: "documentColumn",
            children: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "첫 번째 열" }],
              },
            ],
          },
          {
            type: "documentColumn",
            children: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "두 번째 열" }],
              },
            ],
          },
        ],
      },
    ]),
    "json",
  );
  expect(result.blocks.map((block) => block.spans[0]?.text)).toEqual([
    "첫 번째 열",
    "두 번째 열",
  ]);
  expect(result.blocks.some((block) => block.kind === "notice")).toBe(false);
});

test("HTML imports render only inert native content; images are manual links with no automatic requests", () => {
  const result = parseContent(
    '<h2>제목</h2><p>본문 <b>강조</b><img src="https://example.test/pixel" alt="사진" /></p><script>hidden()</script><iframe src="https://example.test"></iframe><a href="javascript:bad()">안전한 글자</a>',
    "html",
  );
  const serialized = JSON.stringify(result);
  expect(serialized).toContain("본문");
  expect(serialized).toContain("[이미지: 사진]");
  expect(serialized).not.toContain("hidden()");
  expect(serialized).not.toContain("javascript:");
  expect(serialized).not.toContain("iframe");
});

test("unsafe links and invalid JSON cannot fall back to raw internal fields", () => {
  for (const link of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "//evil.test",
    "data:text/html,test",
    "https://user:pass@example.test",
    "https://example.test/\npath",
  ])
    expect(safeLink(link)).toBeUndefined();
  expect(safeLink("mailto:person@example.test")).toBe(
    "mailto:person@example.test",
  );
  expect(
    JSON.stringify(parseContent('{"internalSecret": "nope"', "json")),
  ).not.toContain("nope");
});

test("visible document trees handle inaccessible parents and corrupt cycles without fetching ancestor names", () => {
  const nodes = [
    { ...documentNode, id: "child", parentId: "hidden-parent" },
    { ...documentNode, id: "loop-a", parentId: "loop-b" },
    { ...documentNode, id: "loop-b", parentId: "loop-a" },
  ];
  const tree = documentTree(nodes);
  expect(tree).toHaveLength(3);
  expect(tree[0]).toMatchObject({ depth: 0, node: { id: "child" } });
  expect(tree.some(({ node }) => node.id === "hidden-parent")).toBe(false);
});
