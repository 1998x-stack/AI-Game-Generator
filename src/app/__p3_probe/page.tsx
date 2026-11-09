import { notFound } from "next/navigation";
import ProbeClient from "./ProbeClient";

// Only available while running the local development server for CI.
export default function P3SandboxProbePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProbeClient />;
}
