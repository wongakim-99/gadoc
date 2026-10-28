import { expect, test } from "playwright/test";
import { createWorkspaceFixture, e2eApiUrl } from "./support/slacord-api";
import { io } from "socket.io-client";
import { loginWithSession } from "./support/slacord-session";

function samplePdf() {
  const stream = "BT /F1 18 Tf 30 120 Td (Preview PDF) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test("private files preview text safely, download separately, recover access errors and display PDF", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await createWorkspaceFixture();
  await loginWithSession(page, fixture.owner);
  const cspViolations: string[] = [];
  await page.exposeFunction("recordPreviewCsp", (directive: string) =>
    cspViolations.push(directive),
  );
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as any).recordPreviewCsp(event.violatedDirective);
    }),
  );
  const markup =
    "<h1>Plain preview</h1><script>window.previewExecuted = true</script>";
  const mockStorage = process.env.SLACORD_E2E_MOCK_FILE_STORAGE === "1";
  if (
    mockStorage &&
    !["127.0.0.1", "localhost"].includes(new URL(e2eApiUrl).hostname)
  )
    throw new Error("Mock storage is local-only");
  let denyPreview = false;
  const attachments = [];
  for (const file of [
    {
      name: "preview-note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("로컬 파일 미리보기 확인"),
    },
    {
      name: "preview-markup.html",
      mimeType: "text/html",
      buffer: Buffer.from(markup),
    },
    {
      name: "preview-document.pdf",
      mimeType: "application/pdf",
      buffer: samplePdf(),
    },
  ]) {
    if (mockStorage) {
      const url = `/api/files?key=gadoc/local-preview/${file.name}`;
      attachments.push({
        name: file.name,
        size: file.buffer.length,
        mimeType: "application/octet-stream",
        url,
      });
      await page.route(`**${url}`, (route) =>
        route.fulfill({
          status: denyPreview ? 403 : 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-disposition": `attachment; filename="${file.name}"`,
          },
          body: denyPreview ? Buffer.from("denied") : file.buffer,
        }),
      );
      continue;
    }
    const form = new FormData();
    form.append(
      "file",
      new Blob([file.buffer], { type: file.mimeType }),
      file.name,
    );
    form.append("teamId", fixture.teamId);
    const response = await fetch(
      `${e2eApiUrl}/channel/${fixture.channelId}/message/attachment`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${fixture.owner.token}` },
        body: form,
      },
    );
    expect(response.ok, await response.clone().text()).toBe(true);
    attachments.push((await response.json()).data);
  }
  const socket = io(`${e2eApiUrl.replace(/\/api$/, "")}/chat`, {
    transports: ["websocket"],
    auth: { token: fixture.owner.token },
    forceNew: true,
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    const ack = await socket.timeout(10000).emitWithAck("send_message", {
      teamId: fixture.teamId,
      channelId: fixture.channelId,
      content: "File preview acceptance",
      attachments: mockStorage ? [] : attachments,
    });
    expect(ack.success).not.toBe(false);
  } finally {
    socket.disconnect();
  }
  if (mockStorage)
    await page.route(
      `**/channel/${fixture.channelId}/message?*`,
      async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        data.data = data.data.map((message: any) =>
          message.content === "File preview acceptance"
            ? { ...message, attachments }
            : message,
        );
        await route.fulfill({ response, json: data });
      },
    );
  await page.goto(`/${fixture.teamId}/channel/${fixture.channelId}`);
  const textButton = page.getByRole("button", {
    name: "preview-note.txt 미리보기",
    exact: true,
  });
  await textButton.click();
  let dialog = page.getByRole("dialog", {
    name: "preview-note.txt",
    exact: true,
  });
  await expect(dialog.locator("pre")).toHaveText("로컬 파일 미리보기 확인");
  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByRole("link", { name: "파일 다운로드", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("preview-note");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(textButton).toBeFocused();

  await page
    .getByRole("button", { name: "preview-markup.html 미리보기", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "preview-markup.html",
    exact: true,
  });
  await expect(dialog.locator("pre")).toHaveText(markup);
  expect(
    await page.evaluate(() => (window as any).previewExecuted),
  ).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath("text-preview.png") });
  await dialog.getByRole("button", { name: "미리보기 닫기" }).click();

  denyPreview = true;
  if (!mockStorage)
    await page.route("**/api/files?key=*", (route) =>
      route.fulfill({ status: 403, body: "denied" }),
    );
  await textButton.click();
  dialog = page.getByRole("dialog", { name: "preview-note.txt", exact: true });
  await expect(dialog.getByRole("alert")).toContainText("접근 권한");
  denyPreview = false;
  if (!mockStorage) await page.unroute("**/api/files?key=*");
  await dialog.getByRole("button", { name: "다시 불러오기" }).click();
  await expect(dialog.locator("pre")).toHaveText("로컬 파일 미리보기 확인");
  await dialog.getByRole("button", { name: "미리보기 닫기" }).click();

  await page
    .getByRole("button", { name: "preview-document.pdf 미리보기", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "preview-document.pdf",
    exact: true,
  });
  const frame = dialog.locator("iframe");
  await expect(frame).toHaveAttribute("src", /^blob:/);
  await expect(frame).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("pdf-preview.png") });
  expect(
    cspViolations.filter((directive) =>
      /frame-src|child-src|object-src/.test(directive),
    ),
  ).toEqual([]);
  await dialog.getByRole("button", { name: "미리보기 닫기" }).click();
  await expect(dialog).toHaveCount(0);
});
