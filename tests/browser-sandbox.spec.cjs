const { test, expect } = require("@playwright/test");

test("real generated srcdoc cannot read parent storage or DOM", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/p3-sandbox-probe");
  await page.evaluate(() => {
    localStorage.setItem("p3-browser-secret", "must-not-leak");
  });
  await page.reload();

  const sandbox = page.locator("iframe[title='Game Preview (isolated sandbox)']");
  await expect(sandbox).toHaveAttribute("sandbox", "allow-scripts");
  await expect(sandbox).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.getByTestId("p3-sandbox-result")).toHaveText("isolated");
  const parentSecret = await page.evaluate(() => localStorage.getItem("p3-browser-secret"));
  expect(parentSecret).toBe("must-not-leak");

  // Fake message from the parent itself must be rejected as not from the iframe.
  await page.evaluate(() => window.postMessage({
    type: "p3-sandbox-result", parentStorage: "leaked",
    parentDom: "leaked", childOrigin: "http://127.0.0.1:3000"
  }, "*"));
  await expect(page.getByTestId("p3-sandbox-result")).toHaveText("isolated");
});

test("probe is a local-only route and not production surface", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/p3-sandbox-probe");
  await expect(page.getByRole("heading", { name: /Dev-only generated game preview isolation probe/ })).toBeVisible();
});
