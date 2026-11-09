"use client";

import { useEffect, useRef, useState } from "react";
import { SandboxIframe } from "@/components/SandboxIframe";

const PROBE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
setTimeout(function () {
  let parentStorage = "unavailable";
  let parentDom = "unavailable";
  try {
    parentStorage = window.parent.localStorage.getItem("p3-browser-secret");
  } catch (_) { parentStorage = "blocked"; }
  try {
    parentDom = window.parent.document.title;
  } catch (_) { parentDom = "blocked"; }
  window.parent.postMessage({
    type: "p3-sandbox-result",
    parentStorage: parentStorage,
    parentDom: parentDom,
    childOrigin: window.location.origin
  }, "*");
}, 350);
<\/script>
</body></html>`;

export default function ProbeClient() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [result, setResult] = useState("pending");
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "p3-sandbox-result") return;
      const blocked = event.data.parentStorage === "blocked" &&
        event.data.parentDom === "blocked" && event.origin === "null";
      setResult(blocked ? "isolated" : "unsafe");
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);
  return <main>
    <h1>Dev-only generated game preview isolation probe</h1>
    <output data-testid="p3-sandbox-result" aria-live="polite">{result}</output>
    <div style={{width: 500, height: 300}}>
      <SandboxIframe html={PROBE_HTML} ref={frame} />
    </div>
  </main>;
}
