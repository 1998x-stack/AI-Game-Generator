"use client";

import { forwardRef } from "react";

interface SandboxIframeProps {
  html: string | null;
}

/**
 * Generated HTML is untrusted code. Scripts need to run for the preview,
 * but must never inherit this app's origin, cookies, localStorage or DOM.
 */
export const SandboxIframe = forwardRef<HTMLIFrameElement, SandboxIframeProps>(
  function SandboxIframe({ html }, ref) {
    if (!html) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 text-sm">Describe a game to get started</p>
        </div>
      );
    }

    return (
      <iframe
        ref={ref}
        srcDoc={html}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title="Game Preview (isolated sandbox)"
        className="w-full h-full border-0"
      />
    );
  }
);
