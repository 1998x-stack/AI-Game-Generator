"use client";

import { forwardRef, useEffect, useRef, useImperativeHandle } from "react";

interface SandboxIframeProps {
  html: string | null;
}

export const SandboxIframe = forwardRef<HTMLIFrameElement, SandboxIframeProps>(function SandboxIframe({ html }, ref) {
  const innerRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => innerRef.current as HTMLIFrameElement);

  useEffect(() => {
    if (html && innerRef.current) {
      innerRef.current.srcdoc = html;
    }
  }, [html]);

  if (!html) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-600 text-sm">Describe a game to get started</p>
      </div>
    );
  }

  return (
    <iframe
      ref={innerRef}
      sandbox="allow-scripts allow-same-origin"
      title="Game Preview"
      className="w-full h-full border-0"
    />
  );
});
