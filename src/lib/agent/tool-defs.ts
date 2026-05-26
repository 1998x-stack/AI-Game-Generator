import fs from "fs/promises";
import path from "path";
import { validatePath } from "./tools";
import { build } from "@/lib/build/bundler";
import type { ToolDef, ToolResult } from "./factory";

export const baseTools: ToolDef[] = [
  {
    name: "read_file",
    description: "Read the contents of a file from user_space or workspace",
    parameters: {
      filePath: { type: "string", description: "Path to the file to read" },
    },
    execute: async (args, sessionId) => {
      try {
        const resolvedPath = validatePath(sessionId, args.filePath as string, "read");
        const content = await fs.readFile(resolvedPath, "utf-8");
        return { content };
      } catch (e) {
        return { error: String(e) };
      }
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file in user_space/scripts/ or user_space/assets/",
    parameters: {
      filePath: { type: "string", description: "Path relative to user_space (e.g., scripts/main.js)" },
      content: { type: "string", description: "File content to write" },
    },
    execute: async (args, sessionId) => {
      try {
        const resolvedPath = validatePath(sessionId, args.filePath as string, "write");
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, args.content as string);
        return { success: true };
      } catch (e) {
        return { error: String(e) };
      }
    },
  },
  {
    name: "edit_file",
    description: "Modify an existing file by replacing old_string with new_string. Must match exactly.",
    parameters: {
      filePath: { type: "string", description: "Path to the file to edit" },
      oldString: { type: "string", description: "Text to find and replace" },
      newString: { type: "string", description: "Replacement text" },
    },
    execute: async (args, sessionId) => {
      try {
        const resolvedPath = validatePath(sessionId, args.filePath as string, "write");
        let content = await fs.readFile(resolvedPath, "utf-8");
        const oldStr = args.oldString as string;
        if (!content.includes(oldStr)) {
          return { error: "oldString not found in file. Read the file first to get exact text." };
        }
        content = content.replace(oldStr, args.newString as string);
        await fs.writeFile(resolvedPath, content);
        return { success: true };
      } catch (e) {
        return { error: String(e) };
      }
    },
  },
  {
    name: "build_game",
    description: "Package all game files into a single HTML. Call after making ANY code changes to show the user the result.",
    parameters: {},
    execute: async (_args, sessionId) => {
      try {
        const result = await build(sessionId);
        return {
          html: result.html,
          errors: result.errors,
          warnings: result.warnings,
          success: result.errors.length === 0,
        };
      } catch (e) {
        return { error: String(e) };
      }
    },
  },
  {
    name: "ask_user",
    description: "Ask the user a multiple-choice question when you need clarification",
    parameters: {
      question: { type: "string", description: "The question to ask" },
      options: {
        type: "string",
        description: "Options separated by | (e.g., 'Faster|Slower|Keep current speed')",
      },
    },
    execute: async (args) => {
      return {
        status: "waiting_for_user",
        question: args.question,
        options: args.options,
      };
    },
  },
];
