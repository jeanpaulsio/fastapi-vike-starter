/**
 * SSE streaming client — reads Server-Sent Events from a fetch response.
 * Useful for LLM chat streaming or any streaming API endpoint.
 */

import { getCookie } from "@/lib/cookies";

export interface SSEOptions {
  url: string;
  body: object;
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export function streamSSE({ url, body, onChunk, onDone, onError }: SSEOptions): AbortController {
  const controller = new AbortController();
  const apiUrl = import.meta.env.VITE_API_URL ?? "";
  const token = getCookie("access_token");

  fetch(`${apiUrl}/api${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        onError?.(`Request failed: ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError?.("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onDone?.();
              return;
            }
            // Parse JSON-encoded chunk (handles newlines safely)
            try {
              const parsed: unknown = JSON.parse(data);
              if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
                onError?.((parsed as { error: string }).error);
                return;
              }
              // String chunk from the LLM
              onChunk(typeof parsed === "string" ? parsed : String(parsed));
            } catch {
              // Fallback: treat as raw text if not valid JSON
              onChunk(data);
            }
          }
        }
      }

      onDone?.();
    })
    .catch((err: Error) => {
      if (err.name !== "AbortError") {
        onError?.(err.message);
      }
    });

  return controller;
}
