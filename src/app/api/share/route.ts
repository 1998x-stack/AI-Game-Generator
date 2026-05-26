import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { githubTokenStore } from "@/lib/github-store";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value || "default";
  const creds = githubTokenStore.get(sessionId);

  if (!creds) {
    return NextResponse.json({ error: "Not logged in to GitHub" }, { status: 401 });
  }

  const body = await request.json();
  const { repoName, description, isPrivate } = body;

  if (!repoName) {
    return NextResponse.json({ error: "Repository name required" }, { status: 400 });
  }

  try {
    // Create repo
    const createRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: repoName,
        description: description || "Game generated with AI Game Generator",
        private: !!isPrivate,
        auto_init: false,
      }),
    });

    const repo = await createRes.json();
    if (!createRes.ok) {
      return NextResponse.json({ error: repo.message }, { status: 400 });
    }

    // Get game files
    const userSpace = path.resolve(`sessions/${sessionId}/user_space`);
    const files: Array<{ path: string; content: string }> = [];

    if (fs.existsSync(userSpace)) {
      walkDir(userSpace, userSpace, files);
    }

    // Add README
    files.unshift({
      path: "README.md",
      content: `# ${repoName}\n\n${description || "Game generated with [AI Game Generator](https://github.com)"}\n\n## How to Play\n\nOpen \`game.html\` in any browser.\n`,
    });

    // Push files via GitHub API — create all blobs, then one tree, one commit
    const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    for (const file of files) {
      const blobRes = await fetch(`https://api.github.com/repos/${repo.full_name}/git/blobs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: Buffer.from(file.content).toString("base64"),
          encoding: "base64",
        }),
      });
      const blob = await blobRes.json();
      if (blob.sha) {
        treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      }
    }

    if (treeEntries.length > 0) {
      const treeRes = await fetch(`https://api.github.com/repos/${repo.full_name}/git/trees`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tree: treeEntries }),
      });
      const tree = await treeRes.json();

      const commitRes = await fetch(`https://api.github.com/repos/${repo.full_name}/git/commits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Initial commit from AI Game Generator",
          tree: tree.sha,
        }),
      });
      const commit = await commitRes.json();

      await fetch(`https://api.github.com/repos/${repo.full_name}/git/refs/heads/main`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }),
      });
    }

    return NextResponse.json({ repoUrl: repo.html_url });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function walkDir(dir: string, baseDir: string, files: Array<{ path: string; content: string }>) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, baseDir, files);
    } else {
      files.push({
        path: path.relative(baseDir, full),
        content: fs.readFileSync(full, "utf-8"),
      });
    }
  }
}
