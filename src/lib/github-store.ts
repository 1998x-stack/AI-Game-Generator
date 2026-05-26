interface GitHubCredentials {
  token: string;
  username: string;
}

class GitHubTokenStore {
  private store = new Map<string, GitHubCredentials>();

  set(sessionId: string, creds: GitHubCredentials): void {
    this.store.set(sessionId, creds);
  }

  get(sessionId: string): GitHubCredentials | undefined {
    return this.store.get(sessionId);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

export const githubTokenStore = new GitHubTokenStore();
