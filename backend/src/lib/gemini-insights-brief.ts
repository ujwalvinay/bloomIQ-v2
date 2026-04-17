import {
  extractGeminiText,
  getGeminiApiKey,
  modelCandidates,
} from "@/lib/gemini-plant-profile";

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

function buildSystemInstruction(): string {
  return [
    "You are BloomIQ's conservatory insights writer.",
    "You will receive JSON with factual counts and a short list of plants (names, status, placement).",
    "Write a personalized brief for the owner: 3–5 short paragraphs in plain text (no markdown headings).",
    "Cover: overall health balance, workload (due today / overdue if any), species diversity, and one concrete next step.",
    "Tone: warm, practical, concise. Do not invent plants, rooms, or numbers that are not in the JSON.",
    "No medical or veterinary advice for humans or pets.",
  ].join("\n");
}

export type GeminiInsightsBriefContext = {
  stats: {
    totalPlants: number;
    healthyPlants: number;
    needsAttentionPlants: number;
    livingZones: number;
    tasksDueToday: number;
    overdueTasks: number;
    completedThisWeek: number;
    timezone: string;
  };
  plantsSample: Array<{
    name: string;
    species?: string;
    location?: string;
    status: string;
  }>;
};

export async function fetchGeminiInsightsBrief(
  context: GeminiInsightsBriefContext
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const userJson = JSON.stringify(context, null, 0);

  const contents: GeminiContent[] = [
    {
      role: "user",
      parts: [
        {
          text: `Facts JSON (authoritative):\n${userJson}\n\nWrite the brief now.`,
        },
      ],
    },
  ];

  const body = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction() }],
    },
    contents,
    generationConfig: {
      temperature: 0.42,
      topP: 0.92,
      maxOutputTokens: 1200,
    },
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
        if (res.status === 404) {
          console.warn(`[BloomIQ Gemini insights] Model not found (404): ${model}`);
          continue;
        }
        if (res.status === 429 || res.status === 503) {
          console.warn(
            `[BloomIQ Gemini insights] ${model} → ${res.status} — trying next model.`
          );
          continue;
        }
        console.warn(`[BloomIQ Gemini insights] ${model} →`, res.status);
        return null;
      }

      const text = extractGeminiText(raw)?.trim();
      if (text) {
        if (process.env.NODE_ENV === "development") {
          console.info(`[BloomIQ Gemini insights] OK using model: ${model}`);
        }
        return text;
      }
      console.warn(`[BloomIQ Gemini insights] Empty text from ${model}`);
    }
    return null;
  } catch (err) {
    console.warn("[BloomIQ Gemini insights] Request error", err);
    return null;
  }
}
