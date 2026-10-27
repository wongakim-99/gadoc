import { expect, test } from "playwright/test";

for (const width of [390, 1440]) {
  test(`GaDoc homepage, keyboard preview and signup at ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await page.goto("/");
    await expect(page).toHaveTitle(/GaDoc/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "일의 가닥이",
    );
    await expect(
      page.getByRole("main").getByText("Where work comes together."),
    ).toBeVisible();
    const firstTab = page.getByRole("tab", { name: /대화에서/ });
    await firstTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /문서로/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: /실행까지/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`gadoc-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("link", { name: /우리 팀의 가닥 잡기/ }).click();
    await expect(page).toHaveURL(/\/auth\/register$/);
    expect(errors).toEqual([]);
  });
}
