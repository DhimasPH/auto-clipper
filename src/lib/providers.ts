// Central registry of AI providers used for highlight selection.
// Transcription is done locally (faster-whisper); these pick the highlights.

export type ProviderId =
  | "openai"
  | "gemini"
  | "deepseek"
  | "groq"
  | "openrouter"
  | "xai"
  | "mistral";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "openai", label: "OpenAI (GPT-4o)" },
  { id: "gemini", label: "Google Gemini (2.5 Flash)" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "groq", label: "Groq (Llama 3.3)" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "xai", label: "xAI Grok" },
  { id: "mistral", label: "Mistral" },
];

export const DEFAULT_PROVIDER: ProviderId = "openai";
