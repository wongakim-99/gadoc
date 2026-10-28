// Both the browser and the collaboration codec must recognize these containers.
export const documentColumnsConfig = {
  type: "documentColumns",
  propSchema: { columns: { default: 2, values: [2, 3] } },
  content: "none",
} as const;

export const documentColumnConfig = {
  type: "documentColumn",
  propSchema: {},
  content: "none",
} as const;

function createColumn(title: string, description = "") {
  return {
    type: "documentColumn" as const,
    children: [
      {
        type: "heading" as const,
        props: { level: 2 as const },
        content: title,
      },
      { type: "paragraph" as const, content: description },
    ],
  };
}

export function createDocumentColumns(count: 2 | 3) {
  return {
    type: "documentColumns" as const,
    props: { columns: count },
    children: Array.from({ length: count }, (_, index) =>
      createColumn(`섹션 ${index + 1}`),
    ),
  };
}

/** A fresh outline, never a replacement for existing document content. */
export function createDocumentHubTemplate() {
  const sections = [
    ["문서", "회의록과 가이드를 연결하세요."],
    ["자료", "참고 문서와 링크를 모아 보세요."],
    ["업무", "일정과 이슈 데이터베이스를 연결하세요."],
  ] as const;
  return [
    {
      type: "paragraph" as const,
      content: "팀에서 자주 찾는 문서와 업무를 한곳에 연결하세요.",
    },
    {
      type: "documentColumns" as const,
      props: { columns: 3 as const },
      children: sections.map(([title, description]) =>
        createColumn(title, description),
      ),
    },
    { type: "divider" as const },
    {
      type: "heading" as const,
      props: { level: 2 as const },
      content: "이번 주",
    },
    { type: "paragraph" as const, content: "" },
  ];
}

export const documentMermaidConfig = {
  type: "mermaid",
  propSchema: { code: { default: "flowchart LR\n  A[시작] --> B[완료]" } },
  content: "none",
} as const;
