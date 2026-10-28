// Isolated browser regression: no application server, credentials or remote API.
// Run: node tests/local/chat-navigation.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { buildSync } from "esbuild";
import { chromium } from "playwright";

const bundle = buildSync({
  stdin: {
    resolveDir: process.cwd(),
    loader: "tsx",
    contents: `
import React, { useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useMessageComposer } from './packages/web/src/features/chat/model/useMessageComposer';
import { useStickyScroll } from './packages/web/src/features/chat/model/stickyScroll';
function Composer({scope}) {
    const composer = useMessageComposer({draftScope: scope, members: [], onTyping() {},
        onSend: async content => { window.sent.push(content); await new Promise((resolve, reject) => { window.finish = resolve; window.fail = reject; }); },
        onUpload: async () => {} });
    return <><textarea value={composer.content} onChange={e => composer.handleChange(e.target.value, e.target.selectionStart)} />
        <button id="send" onClick={() => void composer.submit()}>Send</button><p id="error">{composer.sendError}</p></>;
}
function Scroll() {
    const [ready, setReady] = useState(false);
    const [ids, setIds] = useState(Array.from({length:30}, (_, i) => String(i)));
    const anchor = useMemo(() => location.search.includes('anchor') ? { messageId: '10', createdAt:'2026-10-01', offset:-17 } : null, []);
    const scroll = useStickyScroll({ itemIds: ids, ready, restoreAnchor: anchor });
    window.ready = () => setReady(true);
    window.append = () => setIds(current => [...current, 'new']);
    window.prepend = () => { scroll.prepareForPrepend(); setIds(current => ['old', ...current]); };
    return ready ? <div id="scroller" ref={scroll.containerRef} onScroll={scroll.handleScroll} style={{height:200, overflow:'auto'}}>
        {ids.map(id => <div id={'message-'+id} key={id} style={{height:40}}>{id}</div>)}<div ref={scroll.bottomRef}/></div> : <div>Loading</div>;
}
function App() {
    const [scope, setScope] = useState({userId:'u', teamId:'t', channelId:'a'});
    const [visible, setVisible] = useState(true);
    window.changeScope = setScope; window.show = setVisible; window.sent = window.sent || [];
    return location.search.includes('scroll') ? <Scroll/> : visible ? <Composer key={JSON.stringify(scope)} scope={scope}/> : null;
}
createRoot(document.getElementById('root')).render(<App/>);`,
  },
  bundle: true,
  write: false,
  format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
}).outputFiles[0].text;
const server = createServer((request, response) => {
  response.setHeader(
    "Content-Type",
    request.url === "/bundle.js" ? "application/javascript" : "text/html",
  );
  response.end(
    request.url === "/bundle.js"
      ? bundle
      : '<div id="root"></div><script src="/bundle.js"></script>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium
    .launch({ headless: true })
    .catch(() => chromium.launch({ headless: true, channel: "msedge" }));
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.locator("textarea").fill("channel A draft");
  await page.evaluate(() =>
    window.changeScope({ userId: "u", teamId: "t", channelId: "b" }),
  );
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "",
  );
  await page.locator("textarea").fill("channel B draft");
  await page.evaluate(() =>
    window.changeScope({ userId: "u", teamId: "t", channelId: "a" }),
  );
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "channel A draft",
  );
  await page.evaluate(() => window.show(false));
  await page.waitForFunction(() => !document.querySelector("textarea"));
  await page.evaluate(() => window.show(true));
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "channel A draft",
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "channel A draft",
  );
  console.log("PASS navigation, unmount and reload retention");

  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.src = "/";
    document.body.append(frame);
  });
  await page.waitForFunction(() =>
    document
      .querySelector("iframe")
      ?.contentDocument?.querySelector("textarea"),
  );
  const pane = page.frames().find((frame) => frame !== page.mainFrame());
  assert.equal(await pane.locator("textarea").inputValue(), "channel A draft");
  await pane.locator("textarea").fill("split pane draft");
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "split pane draft",
  );
  await page.locator("#send").click();
  await page.locator("#send").click();
  assert.deepEqual(await page.evaluate(() => window.sent), [
    "split pane draft",
  ]);
  await pane.locator("textarea").fill("written while sending");
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "written while sending",
  );
  await page.evaluate(() => window.finish());
  assert.equal(
    await page.locator("textarea").inputValue(),
    "written while sending",
  );
  await page.locator("#send").click();
  await page.evaluate(() => window.fail(new Error("offline")));
  await page.waitForFunction(
    () => document.querySelector("#error")?.textContent,
  );
  assert.equal(
    await page.locator("textarea").inputValue(),
    "written while sending",
  );
  await page.locator("#send").click();
  await page.evaluate(() => window.finish());
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "",
  );
  await pane.waitForFunction(
    () => document.querySelector("textarea")?.value === "",
  );
  console.log(
    "PASS split-pane synchronization, duplicate prevention, send races, failure and successful clearing",
  );

  await page.locator("textarea").fill("belongs to A");
  await page.locator("#send").click();
  await page.evaluate(() =>
    window.changeScope({ userId: "u", teamId: "t", channelId: "b" }),
  );
  await page.waitForFunction(
    () => document.querySelector("textarea")?.value === "channel B draft",
  );
  await page.evaluate(() => window.finish());
  assert.equal(await page.locator("textarea").inputValue(), "channel B draft");
  console.log("PASS late send completion cannot clear another channel");

  await page.goto(origin + "/?scroll");
  await page.waitForFunction(() => typeof window.ready === "function");
  await page.evaluate(() => window.ready());
  await page.waitForFunction(
    () => document.querySelector("#scroller")?.scrollTop === 1000,
  );
  await page.goto(origin + "/?scroll&anchor");
  await page.waitForFunction(() => typeof window.ready === "function");
  await page.evaluate(() => window.ready());
  await page.waitForFunction(
    () => document.querySelector("#scroller")?.scrollTop === 417,
  );
  await page.evaluate(() => window.append());
  await page.waitForFunction(() => document.querySelector("#message-new"));
  assert.equal(
    await page.locator("#scroller").evaluate((element) => element.scrollTop),
    417,
  );
  await page.evaluate(() => window.prepend());
  await page.waitForFunction(
    () => document.querySelector("#scroller")?.scrollTop === 457,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS loading-to-visible initial scroll, exact saved offset, incoming messages and prepend preservation",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
