"use client";

import { useState } from "react";
import { useGitHub } from "@/lib/context/GitHubContext";
import { useGame } from "@/lib/context/GameContext";

export default function ShareButton() {
  const { isLoggedIn, username, login, logout, shareGame } = useGitHub();
  const { gameHtml } = useGame();
  const [showModal, setShowModal] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);

  const handleShare = async () => {
    if (!repoName.trim()) return;
    setSharing(true);
    try {
      const url = await shareGame(repoName.trim(), description.trim(), isPrivate);
      setRepoUrl(url);
    } catch {
      // error handled by context
    }
    setSharing(false);
  };

  if (!isLoggedIn) {
    return (
      <button
        onClick={login}
        disabled={!gameHtml}
        className="px-3 py-1 text-xs font-medium bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 disabled:opacity-40 transition-colors"
      >
        Login to Share
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={!gameHtml}
        className="px-3 py-1 text-xs font-medium bg-green-700 text-green-100 rounded hover:bg-green-600 disabled:opacity-40 transition-colors"
      >
        Share
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Share to GitHub</h2>

            <p className="text-sm text-zinc-500 mb-4">
              Logged in as <span className="font-medium text-zinc-700 dark:text-zinc-300">@{username}</span>
            </p>

            {repoUrl ? (
              <div className="text-center">
                <p className="text-sm text-green-600 mb-3">Repository created!</p>
                <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline break-all">
                  {repoUrl}
                </a>
                <button
                  onClick={() => { setShowModal(false); setRepoUrl(null); }}
                  className="mt-4 w-full px-4 py-2 text-sm bg-blue-500 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Repository name"
                  className="w-full px-3 py-2 mb-3 text-sm border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700"
                />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 mb-3 text-sm border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700"
                />
                <label className="flex items-center gap-2 mb-4 text-sm text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                  Private repository
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-700 rounded-lg">
                    Cancel
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={!repoName.trim() || sharing}
                    className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg disabled:opacity-50"
                  >
                    {sharing ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
