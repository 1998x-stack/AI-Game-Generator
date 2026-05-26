import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

export interface BuildResult {
  html: string;
  errors: string[];
  warnings: string[];
}

export async function build(sessionId: string): Promise<BuildResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sessionUserSpace = path.resolve(`sessions/${sessionId}/user_space`);
  const scriptsDir = path.join(sessionUserSpace, "scripts");
  const assetsDir = path.join(sessionUserSpace, "assets");
  const entryPoint = path.join(scriptsDir, "main.js");

  // Check entry point exists
  if (!fs.existsSync(entryPoint)) {
    errors.push("No entry point found: user_space/scripts/main.js does not exist");
    return { html: "", errors, warnings };
  }

  // Run esbuild
  let bundleOutput = "";
  try {
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      target: "es2020",
      format: "iife",
      write: false,
      absWorkingDir: sessionUserSpace,
    });

    bundleOutput = result.outputFiles?.[0]?.text || "";

    if (result.warnings.length > 0) {
      warnings.push(...result.warnings.map((w) => w.text));
    }
  } catch (e: unknown) {
    const err = e as Error & { errors?: Array<{ text: string }>; warnings?: Array<{ text: string }> };
    if (err.errors) {
      errors.push(...err.errors.map((e) => e.text));
    } else {
      errors.push(err.message || "Build failed");
    }
    if (err.warnings) {
      warnings.push(...err.warnings.map((w) => w.text));
    }
    return { html: "", errors, warnings };
  }

  const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];
  const audioExts = [".mp3", ".wav", ".ogg"];
  let inlineCss = "";
  const assets: Array<{ name: string; type: string; data: string }> = [];

  if (fs.existsSync(assetsDir)) {
    for (const entry of fs.readdirSync(assetsDir)) {
      const assetPath = path.join(assetsDir, entry);
      if (!fs.statSync(assetPath).isFile()) continue;

      const ext = path.extname(entry).toLowerCase();
      if (ext === ".css") {
        inlineCss += fs.readFileSync(assetPath, "utf-8") + "\n";
      } else if (imageExts.includes(ext)) {
        const data = fs.readFileSync(assetPath);
        const mime = ext === ".svg" ? "image/svg+xml" : `image/${ext.slice(1)}`;
        assets.push({ name: entry, type: "image", data: `data:${mime};base64,${data.toString("base64")}` });
      } else if (audioExts.includes(ext)) {
        const data = fs.readFileSync(assetPath);
        const mime = ext === ".mp3" ? "audio/mpeg" : ext === ".wav" ? "audio/wav" : "audio/ogg";
        assets.push({ name: entry, type: "audio", data: `data:${mime};base64,${data.toString("base64")}` });
      }
    }
  }

  // Generate HTML
  const html = generateHtml(bundleOutput, inlineCss, assets);

  return { html, errors, warnings };
}

function generateHtml(scriptContent: string, cssContent: string, assets: Array<{ name: string; type: string; data: string }>): string {
  const assetScript = assets.length > 0 ? `
<script>
window.__gameAssets = ${JSON.stringify(assets.reduce((acc, a) => ({ ...acc, [a.name]: a.data }), {}))};
</script>` : "";

  const errorHandler = `
<script>
(function(){var o=window.onerror;window.onerror=function(m,u,l,c,e){if(window.parent&&window.parent!==window){window.parent.postMessage({type:'game-error',message:String(m),line:l,stack:e&&e.stack?String(e.stack):void 0},'*')}if(o)return o.call(this,m,u,l,c,e);return!1};window.addEventListener('unhandledrejection',function(ev){if(window.parent&&window.parent!==window){window.parent.postMessage({type:'game-error',message:'Unhandled Promise: '+String(ev.reason),stack:ev.reason&&ev.reason.stack?String(ev.reason.stack):void 0},'*')}})})()
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Game</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a0a;overflow:hidden}
canvas{display:block}
${cssContent}
</style>
</head>
<body>
<canvas id="game"></canvas>
${assetScript}<script>${scriptContent}</script>
${errorHandler}
</body>
</html>`;
}
