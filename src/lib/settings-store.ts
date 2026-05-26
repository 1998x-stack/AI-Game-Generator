interface StoredSettings {
  apiKey: string;
  apiUrl: string;
  model: string;
  sdkType?: string;
}

class SettingsStore {
  private store = new Map<string, StoredSettings>();

  set(sessionId: string, settings: StoredSettings): void {
    this.store.set(sessionId, settings);
  }

  get(sessionId: string): StoredSettings | undefined {
    return this.store.get(sessionId);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  get size(): number {
    return this.store.size;
  }
}

export const settingsStore = new SettingsStore();
