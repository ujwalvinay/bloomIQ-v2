import {
  extractGeminiText,
  getGeminiApiKey,
  modelCandidates,
} from "@/lib/gemini-plant-profile";

type GeminiContent = {
  role: "user" | "model";
  parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  >;
};

export function buildPlantCareChatSystemText(input: {
  name: string;
  species?: string;
  location?: string;
  lightLevel?: string;
  notes?: string;
  careRequirements?: string;
  careGuide?: {
    watering?: string;
    sunlight?: string;
    fertilizer?: string;
    temperature?: string;
  };
}): string {
  const lines = [
    "You are BloomIQ's indoor plant care assistant. The user is chatting about one saved specimen from their collection.",
    "Reply in clear, friendly prose. Use short paragraphs or bullet lists when it helps. Be practical and cautious: if you cannot identify a plant from a photo, say so and give safe general houseplant guidance.",
    "Do not give medical or veterinary diagnoses for humans or pets.",
    "",
    "Saved specimen profile:",
    `- Display name: ${input.name.trim() || "(unnamed)"}`,
    `- Species / cultivar: ${(input.species ?? "").trim() || "Not specified"}`,
    `- Location / placement: ${(input.location ?? "").trim() || "Not specified"}`,
    `- Light level (app estimate): ${(input.lightLevel ?? "").trim() || "Unknown"}`,
  ];
  if (input.notes?.trim()) {
    lines.push(`- Owner notes: ${input.notes.trim()}`);
  }
  if (input.careGuide) {
    const g = input.careGuide;
    if (g.watering?.trim()) lines.push(`- Watering (reference): ${g.watering.trim()}`);
    if (g.sunlight?.trim()) lines.push(`- Sunlight (reference): ${g.sunlight.trim()}`);
    if (g.fertilizer?.trim()) {
      lines.push(`- Fertilizer (reference): ${g.fertilizer.trim()}`);
    }
    if (g.temperature?.trim()) {
      lines.push(`- Temperature (reference): ${g.temperature.trim()}`);
    }
  } else if (input.careRequirements?.trim()) {
    lines.push(`- Prior care summary: ${input.careRequirements.trim()}`);
  }
  return lines.join("\n");
}

function mapHistoryToGeminiContents(
  history: { role: "user" | "assistant"; content: string }[]
): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of history) {
    const text = m.content.trim();
    if (!text) continue;
    out.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }
  return out;
}

export async function fetchGeminiPlantCareChatReply(input: {
  systemInstruction: string;
  history: { role: "user" | "assistant"; content: string }[];
  userText: string;
  image?: { mimeType: string; data: string };
}): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const trimmed = input.userText.trim();
  const fallbackUserText =
    "The user attached a new photo of this plant. Describe what you notice and give focused care suggestions for this specimen.";

  const userParts: GeminiContent["parts"] = [];
  if (trimmed) userParts.push({ text: trimmed });
  if (input.image) {
    userParts.push({
      inline_data: {
        mime_type: input.image.mimeType,
        data: input.image.data,
      },
    });
  }
  if (userParts.length === 0) {
    userParts.push({ text: fallbackUserText });
  }

  const contents: GeminiContent[] = [
    ...mapHistoryToGeminiContents(input.history),
    { role: "user", parts: userParts },
  ];

  const generationConfig = {
    temperature: 0.45,
    topP: 0.95,
    maxOutputTokens: 2048,
  };

  const body = {
    systemInstruction: {
      parts: [{ text: input.systemInstruction }],
    },
    contents,
    generationConfig,
  };

  try {
    for (const model of modelCandidates()) {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      const post = (auth: "header" | "query") => {
        const url =
          auth === "header"
            ? baseUrl
            : `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (auth === "header") headers["x-goog-api-key"] = apiKey;
        return fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(55_000),
        });
      };

      const errorSuggestsInvalidApiKey = (rawBody: unknown): boolean => {
        if (!rawBody || typeof rawBody !== "object" || !("error" in rawBody)) {
          return false;
        }
        const err = (rawBody as { error?: { message?: string; status?: string } })
          .error;
        const msg = (err?.message ?? "").toLowerCase();
        const st = (err?.status ?? "").toUpperCase();
        return (
          st === "UNAUTHENTICATED" ||
          /api key not found|invalid api key|api_key_invalid|permission denied/i.test(
            msg
          )
        );
      };

      let res = await post("header");
      let raw = (await res.json()) as unknown;
      const tryQueryFallback =
        !res.ok &&
        (res.status === 400 || res.status === 401 || res.status === 403) &&
        errorSuggestsInvalidApiKey(raw);
      if (tryQueryFallback) {
        res = await post("query");
        raw = (await res.json()) as unknown;
      }

      if (!res.ok) {
        const msg =
          raw &&
          typeof raw === "object" &&
          "error" in raw &&
          (raw as { error?: { message?: string } }).error?.message
            ? String((raw as { error: { message?: string } }).error.message)
            : res.statusText;
        if (res.status === 404) {
          console.warn(`[BloomIQ Gemini chat] Model not found (404): ${model}`);
          continue;
        }
        if (res.status === 429 || res.status === 503) {
          console.warn(
            `[BloomIQ Gemini chat] ${model} → ${res.status} — trying next model.`
          );
          continue;
        }
        console.warn(`[BloomIQ Gemini chat] ${model} →`, res.status, msg);
        return null;
      }

      const text = extractGeminiText(raw)?.trim();
      if (text) {
        if (process.env.NODE_ENV === "development") {
          console.info(`[BloomIQ Gemini chat] OK using model: ${model}`);
        }
        return text;
      }
      console.warn(`[BloomIQ Gemini chat] Empty text from ${model}`);
    }
    return null;
  } catch (err) {
    console.warn("[BloomIQ Gemini chat] Request error", err);
    return null;
  }
}
