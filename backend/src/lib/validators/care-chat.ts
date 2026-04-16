import { z } from "zod";

const chatRoleSchema = z.enum(["user", "assistant"]);

export const careChatBodySchema = z.object({
  history: z
    .array(
      z.object({
        role: chatRoleSchema,
        content: z.string().max(12_000),
      })
    )
    .max(40),
  message: z.string().max(8000),
  imageBase64: z.string().max(4_500_000).optional(),
  imageMimeType: z.string().max(80).optional(),
});

export type CareChatBody = z.infer<typeof careChatBodySchema>;

export function validateCareChatHistory(
  history: CareChatBody["history"]
): string | null {
  if (history.length % 2 !== 0) {
    return "History must be complete alternating user and assistant messages.";
  }
  if (history.length > 0 && history[0]!.role !== "user") {
    return "History must start with a user message.";
  }
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]!.role;
    const curr = history[i]!.role;
    if (prev === curr) {
      return "History roles must alternate user and assistant.";
    }
  }
  if (history.length > 0 && history[history.length - 1]!.role !== "assistant") {
    return "History must end with an assistant message before a new user turn.";
  }
  return null;
}
