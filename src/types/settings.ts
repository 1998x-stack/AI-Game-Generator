export interface Settings {
  apiKey: string;
  apiUrl: string;
  model: string;
  fallbackModel: string;
  sdkType?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  apiUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  fallbackModel: "deepseek-v4-flash",
  sdkType: "opencode",
};
