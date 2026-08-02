// Central registry of AI providers used for highlight selection.
// Transcription is done locally (faster-whisper); these pick the highlights.

export type ProviderId =
  | "openai"
  | "gemini"
  | "gemini-2.0-flash-lite"
  | "gemini-1.5-flash"
  | "gemini-1.5-pro"
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
  { id: "gemini", label: "Google Gemini (2.0 Flash)" },
  { id: "gemini-2.0-flash-lite", label: "Google Gemini (2.0 Flash Lite)" },
  { id: "gemini-1.5-flash", label: "Google Gemini (1.5 Flash)" },
  { id: "gemini-1.5-pro", label: "Google Gemini (1.5 Pro)" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "groq", label: "Groq (Llama 3.3)" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "xai", label: "xAI Grok" },
  { id: "mistral", label: "Mistral" },
  { id: "custom", label: "Custom (OpenAI Compatible)" },
];

export const DEFAULT_PROVIDER: ProviderId = "openai";
