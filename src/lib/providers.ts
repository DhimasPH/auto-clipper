// Central registry of AI providers used for highlight selection.
// Transcription is done locally (faster-whisper); these pick the highlights.

export type ProviderId =
  | "openai"
  | "gemini"
  | "gemini-3.5-flash-lite"
  | "gemini-3.1-pro"
  | "deepseek"
  | "groq"
  | "openrouter"
  | "xai"
  | "mistral"
  | "custom"
  | "manual_ai";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "openai", label: "OpenAI (GPT-4o)" },
  { id: "gemini", label: "Google Gemini (3.6 Flash)" },
  { id: "gemini-3.5-flash-lite", label: "Google Gemini (3.5 Flash Lite)" },
  { id: "gemini-3.1-pro", label: "Google Gemini (3.1 Pro)" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "groq", label: "Groq (Llama 3.3)" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "xai", label: "xAI Grok" },
  { id: "mistral", label: "Mistral" },
  { id: "custom", label: "Custom (OpenAI Compatible)" },
];

export const DEFAULT_PROVIDER: ProviderId = "openai";
