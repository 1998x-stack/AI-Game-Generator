import path from "path";

export function validatePath(sessionId: string, filePath: string, operation: "read" | "write"): string {
  const resolved = path.resolve(filePath);
  const sessionUserSpace = path.resolve(`sessions/${sessionId}/user_space`);
  const workspaceRoot = path.resolve("workspace");

  if (operation === "write") {
    if (!resolved.startsWith(sessionUserSpace + path.sep) && resolved !== sessionUserSpace) {
      throw new Error(`Write denied: path outside user_space`);
    }
  }

  if (operation === "read") {
    if (
      !resolved.startsWith(sessionUserSpace + path.sep) &&
      resolved !== sessionUserSpace &&
      !resolved.startsWith(workspaceRoot + path.sep) &&
      resolved !== workspaceRoot
    ) {
      throw new Error(`Read denied: path outside allowed directories`);
    }
  }

  return resolved;
}
