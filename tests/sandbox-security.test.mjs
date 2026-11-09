import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Static safety regression: does not replace a browser escape test. */
test("generated code cannot request same-origin sandbox privilege", () => {
  const iframe = readFileSync("src/components/SandboxIframe.tsx", "utf8");
  assert.match(iframe, /sandbox="allow-scripts"/);
  assert.doesNotMatch(iframe, /allow-same-origin/);
  assert.match(iframe, /srcDoc=\{html\}/);
  assert.match(iframe, /referrerPolicy="no-referrer"/);
});

test("messages must be tied to the current preview window", () => {
  const component = readFileSync("src/components/GamePreview.tsx", "utf8");
  assert.match(component, /event\.source !== iframeRef\.current\?\.contentWindow/);
  assert.match(component, /typeof event\.data !== "object"/);
  assert.match(component, /event\.data\.message\.slice\(0, 300\)/);
});
