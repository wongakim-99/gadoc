const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDocumentColumns, createDocumentHubTemplate } = require("../dist");

test("column outlines have independent editable child blocks without fixed IDs", () => {
  for (const count of [2, 3]) {
    const layout = createDocumentColumns(count);
    assert.equal(layout.props.columns, count);
    assert.equal(layout.children.length, count);
    assert.ok(
      layout.children.every((column) => column.children[0].type === "heading"),
    );
    layout.children[0].children[1].content = "edited";
    assert.equal(layout.children[1].children[1].content, "");
    assert.equal(
      JSON.stringify(createDocumentColumns(count)).includes("edited"),
      false,
    );
    assert.equal(JSON.stringify(layout).includes('"id"'), false);
  }
});

test("hub templates use real blocks, contain no invented links or database IDs and are fresh per call", () => {
  const template = createDocumentHubTemplate();
  assert.deepEqual(
    template[1].children.map((column) => column.children[0].content),
    ["문서", "자료", "업무"],
  );
  assert.equal(template.at(-1).type, "paragraph");
  assert.equal(JSON.stringify(template).includes("databaseId"), false);
  assert.equal(JSON.stringify(template).includes("href"), false);
  template[1].children[0].children[0].content = "changed";
  assert.equal(
    createDocumentHubTemplate()[1].children[0].children[0].content,
    "문서",
  );
});
