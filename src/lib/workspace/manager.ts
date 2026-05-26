import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { initWorkspace } from "./init";

const WORKSPACE_ROOT = path.resolve("sessions");

export interface SessionWorkspace {
  sessionId: string;
  rootPath: string;
  userSpacePath: string;
  scriptsPath: string;
  assetsPath: string;
}

export function createSession(sessionId?: string): SessionWorkspace {
  const sid = sessionId || randomUUID();
  const rootPath = path.join(WORKSPACE_ROOT, sid);
  const userSpacePath = path.join(rootPath, "user_space");
  const scriptsPath = path.join(userSpacePath, "scripts");
  const assetsPath = path.join(userSpacePath, "assets");

  fs.mkdirSync(scriptsPath, { recursive: true });
  fs.mkdirSync(assetsPath, { recursive: true });

  const session: SessionWorkspace = { sessionId: sid, rootPath, userSpacePath, scriptsPath, assetsPath };
  initWorkspace(session);

  return session;
}

export function getSession(sessionId: string): SessionWorkspace | null {
  const rootPath = path.join(WORKSPACE_ROOT, sessionId);
  if (!fs.existsSync(rootPath)) return null;
  return {
    sessionId,
    rootPath,
    userSpacePath: path.join(rootPath, "user_space"),
    scriptsPath: path.join(rootPath, "user_space", "scripts"),
    assetsPath: path.join(rootPath, "user_space", "assets"),
  };
}

export function deleteSession(sessionId: string): void {
  const rootPath = path.join(WORKSPACE_ROOT, sessionId);
  if (fs.existsSync(rootPath)) {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
}

export function listUserSpaceFiles(session: SessionWorkspace): string {
  const files: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const stat = fs.statSync(full);
        files.push(`${full.replace(session.userSpacePath, "")} (${stat.size} bytes)`);
      }
    }
  }
  walk(session.userSpacePath);
  return files.length > 0 ? files.join("\n") : "(empty)";
}
