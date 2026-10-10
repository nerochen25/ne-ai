export type Tool = "chat" | "code" | "image" | "music" | "video";
export type GenerationStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status: GenerationStatus;
}
export interface Conversation {
  id: string;
  ownerId: string;
  title: string;
  tool: "chat" | "code";
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  activeGeneration: { id: string; status: "queued" | "running" } | null;
}
export interface Asset {
  id: string;
  generationId: string;
  ownerId: string;
  key: string;
  mime: string;
  size: number;
}
export interface Generation {
  id: string;
  ownerId: string;
  conversationId: string | null;
  tool: Tool;
  prompt: string;
  status: GenerationStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
  title: string;
  favorite: boolean;
  providerId: string | null;
  cancelRequested: boolean;
  inputTokens: number;
  outputTokens: number;
  options: { size?: string };
  idempotencyKey: string;
  fingerprint: string;
}
export interface LibraryItem {
  id: string;
  kind: "conversation" | "generation";
  title: string;
  tool: Tool;
  favorite: boolean;
  updatedAt: string;
  status?: GenerationStatus;
  assets?: Asset[];
  prompt?: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  total: number;
}
export interface Capabilities {
  chat: boolean;
  code: boolean;
  image: boolean;
  music: boolean;
  video: boolean;
  imageSizes: string[];
  missing: string[];
  dailyLimit: number;
}
export type StreamEvent =
  | { type: "start"; generationId: string; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "progress"; status: "searching" | "thinking" }
  | { type: "done"; generationId: string }
  | { type: "error"; message: string; requestId: string };
