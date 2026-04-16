import { z } from "zod";

function stripQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

/**
 * Reads GEMINI_API_KEY from the environment. Handles common .env quirks
 * (spaces around `=`, quoted values) and keys that were accidentally named with trailing spaces.
 */
export function getGeminiApiKey(): string | undefined {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
  ];
  for (const direct of candidates) {
    if (direct) return stripQuotes(direct);
  }
  for (const [name, val] of Object.entries(process.env)) {
    if (!val) continue;
    const n = name.trim();
    if (n === "GEMINI_API_KEY" || n === "GOOGLE_API_KEY") return stripQuotes(val);
  }
  return undefined;
}

function modelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  /** Prefer 1.5 first — free-tier quotas are often separate from 2.0-flash (common 429 target). */
  const defaults = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-flash-latest",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  if (fromEnv) {
    out.push(fromEnv);
    seen.add(fromEnv);
  }
  for (const m of defaults) {
    if (!seen.has(m)) {
      out.push(m);
      seen.add(m);
    }
  }
  return out;
}

export const PLANT_LIGHT_LEVELS = [
  "low",
  "medium",
  "bright_indirect",
  "full_sun",
  "unknown",
] as const;

export type PlantLightLevel = (typeof PLANT_LIGHT_LEVELS)[number];

const careGuideSchema = z.object({
  watering: z.string().trim().min(1).max(2500),
  sunlight: z.string().trim().min(1).max(2500),
  fertilizer: z.string().trim().min(1).max(2500),
  temperature: z.string().trim().min(1).max(2500),
});

const profileSchema = z.object({
  lightLevel: z.enum(PLANT_LIGHT_LEVELS),
  careGuide: careGuideSchema,
});

export type GeminiCareGuide = z.infer<typeof careGuideSchema>;
export type GeminiPlantProfile = z.infer<typeof profileSchema>;

function buildPrompt(input: {
  name: string;
  species?: string;
  location?: string;
}): string {
  const species = input.species?.trim() || "Not specified";
  const location = input.location?.trim() || "Not specified";
  return `You are an expert indoor plant care assistant.

Infer practical care guidance for this plant:
- Display name: ${JSON.stringify(input.name.trim())}
- Species / cultivar (may be vague or missing): ${JSON.stringify(species)}
- Room or placement hint: ${JSON.stringify(location)}

Respond with JSON only (no markdown fences) matching exactly this shape:
{"lightLevel":"<one of: low, medium, bright_indirect, full_sun, unknown>","careGuide":{"watering":"<string>","sunlight":"<string>","fertilizer":"<string>","temperature":"<string>"}}

Rules:
- lightLevel: choose the closest typical indoor need for healthy growth. Use "unknown" only if the plant cannot be reasoned about at all.
- For EACH of careGuide.watering, careGuide.sunlight, careGuide.fertilizer, careGuide.temperature: the value MUST be a SINGLE JSON string containing ONLY bullet lines separated by the newline character \\n (no paragraph prose).
- Each line MUST start with "- " then ONE short actionable fact (max ~120 characters per line). Use 5 to 8 lines per section. No blank lines. Example format inside the JSON string: "- First fact\\n- Second fact\\n- Third fact"
- Cover the same topics as before (watering schedule, drainage, light hours/orientation, fertilizer type and timing, temperature range and drafts) but as separate bullets, not merged into sentences.

Be specific to this plant when species is known; otherwise infer from the display name and safe houseplant defaults. No medical claims for humans or pets.`;
}

function extractJsonText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const promptFeedback = root.promptFeedback as
    | { blockReason?: string; blockReasonMessage?: string }
    | undefined;
  if (promptFeedback?.blockReason) {
    console.warn(
      "[BloomIQ Gemini] Prompt blocked:",
      promptFeedback.blockReason,
      promptFeedback.blockReasonMessage ?? ""
    );
    return null;
  }
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    console.warn("[BloomIQ Gemini] No candidates in response");
    return null;
  }
  const first = candidates[0] as Record<string, unknown>;
  const finish = first.finishReason;
  if (finish && finish !== "STOP") {
    console.warn("[BloomIQ Gemini] finishReason:", finish);
  }
  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    console.warn(
      "[BloomIQ Gemini] No content parts; candidate keys:",
      first ? Object.keys(first).join(", ") : "none"
    );
    return null;
  }
  const chunks = parts
    .map((p) => {
      const t = (p as Record<string, unknown>)?.text;
      return typeof t === "string" ? t : "";
    })
    .filter(Boolean);
  const joined = chunks.join("").trim();
  return joined || null;
}

/** Strip ```json ... ``` wrappers the model sometimes adds despite instructions. */
function unwrapJsonFence(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

function normalizeLightLevel(raw: unknown): (typeof PLANT_LIGHT_LEVELS)[number] {
  if (typeof raw !== "string") return "unknown";
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, (typeof PLANT_LIGHT_LEVELS)[number]> = {
    low: "low",
    shade: "low",
    "low_light": "low",
    medium: "medium",
    medium_light: "medium",
    moderate: "medium",
    bright_indirect: "bright_indirect",
    brightindirect: "bright_indirect",
    indirect: "bright_indirect",
    indirect_light: "bright_indirect",
    filtered_light: "bright_indirect",
    full_sun: "full_sun",
    fullsun: "full_sun",
    direct_sun: "full_sun",
    directsun: "full_sun",
    sun: "full_sun",
    unknown: "unknown",
  };
  if (aliases[s]) return aliases[s];
  if ((PLANT_LIGHT_LEVELS as readonly string[]).includes(s)) {
    return s as (typeof PLANT_LIGHT_LEVELS)[number];
  }
  return "unknown";
}

function normalizeProfileJson(parsed: unknown): unknown {
  let root = parsed;
  if (Array.isArray(root) && root.length > 0) {
    root = root[0];
  }
  if (!root || typeof root !== "object") return parsed;
  const o = { ...(root as Record<string, unknown>) };
  o.lightLevel = normalizeLightLevel(o.lightLevel);
  const rawGuide = o.careGuide;
  if (!rawGuide || typeof rawGuide !== "object") return o;
  const g = rawGuide as Record<string, unknown>;
  const keyGroups = [
    ["watering", "Watering", "WATERING"],
    ["sunlight", "Sunlight", "SUNLIGHT", "light", "Light"],
    ["fertilizer", "Fertilizer", "FERTILIZER", "fertilizing", "Fertilizing"],
    ["temperature", "Temperature", "TEMPERATURE", "temp", "Temp"],
  ] as const;
  const out: Record<string, string> = {};
  for (const variants of keyGroups) {
    const canonical = variants[0]!;
    for (const k of variants) {
      const v = g[k];
      if (typeof v === "string" && v.trim()) {
        out[canonical] = v.trim();
        break;
      }
    }
  }
  return {
    ...o,
    careGuide: { ...g, ...out },
  };
}

/**
 * Calls Google Gemini (Generative Language API) to infer light level and structured care (four sections).
 * Returns null if GEMINI_API_KEY is unset, the request fails, or the response is invalid.
 */
export async function fetchGeminiPlantProfile(input: {
  name: string;
  species?: string;
  location?: string;
}): Promise<GeminiPlantProfile | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const name = input.name?.trim();
  if (!name) return null;

  const contents = [
    {
      role: "user" as const,
      parts: [{ text: buildPrompt({ name, species: input.species, location: input.location }) }],
    },
  ];

  const generationConfigLoose = {
    temperature: 0.35,
    topP: 0.9,
    maxOutputTokens: 2048,
    responseMimeType: "application/json" as const,
  };

  const generationConfigStrict = {
    ...generationConfigLoose,
    responseSchema: {
      type: "OBJECT",
      properties: {
        lightLevel: { type: "STRING" },
        careGuide: {
          type: "OBJECT",
          properties: {
            watering: { type: "STRING" },
            sunlight: { type: "STRING" },
            fertilizer: { type: "STRING" },
            temperature: { type: "STRING" },
          },
          required: ["watering", "sunlight", "fertilizer", "temperature"],
        },
      },
      required: ["lightLevel", "careGuide"],
    },
  };

  try {
    for (const model of modelCandidates()) {
      const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

      /** Prefer header auth — required for some key formats (e.g. AQ.*); query `?key=` can fail. */
      const post = (generationConfig: object, auth: "header" | "query") => {
        const url =
          auth === "header"
            ? baseUrl
            : `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (auth === "header") {
          headers["x-goog-api-key"] = apiKey;
        }
        return fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ contents, generationConfig }),
          signal: AbortSignal.timeout(28_000),
        });
      };

      const errorSuggestsInvalidApiKey = (body: unknown): boolean => {
        if (!body || typeof body !== "object" || !("error" in body)) return false;
        const err = (body as { error?: { message?: string; status?: string } })
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

      const runOnce = async (generationConfig: object) => {
        let res = await post(generationConfig, "header");
        let raw = (await res.json()) as unknown;
        const tryQueryFallback =
          !res.ok &&
          (res.status === 400 || res.status === 401 || res.status === 403) &&
          errorSuggestsInvalidApiKey(raw);
        if (tryQueryFallback) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[BloomIQ Gemini] Model ${model}: header auth rejected (${res.status}), retrying with ?key= query param.`
            );
          }
          res = await post(generationConfig, "query");
          raw = (await res.json()) as unknown;
        }
        return { res, raw };
      };

      let { res, raw } = await runOnce(generationConfigStrict);

      if (!res.ok && res.status === 400) {
        console.warn(
          `[BloomIQ Gemini] Model ${model}: retrying without responseSchema after HTTP 400.`
        );
        ({ res, raw } = await runOnce(generationConfigLoose));
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
          console.warn(`[BloomIQ Gemini] Model not found (404): ${model} — trying next.`);
          continue;
        }
        if (res.status === 429 || res.status === 503) {
          console.warn(
            `[BloomIQ Gemini] ${model} → ${res.status} (${res.status === 429 ? "quota/rate limit" : "unavailable"}) — trying next model.`
          );
          if (process.env.NODE_ENV === "development" && msg.length < 500) {
            console.warn(msg);
          }
          continue;
        }
        console.warn(`[BloomIQ Gemini] ${model} →`, res.status, msg);
        return null;
      }

      const text = extractJsonText(raw);
      if (!text?.trim()) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[BloomIQ Gemini] Empty model text; raw (truncated):",
            JSON.stringify(raw).slice(0, 800)
          );
        } else {
          console.warn("[BloomIQ Gemini] Empty model text");
        }
        return null;
      }

      const stripped = unwrapJsonFence(text);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(stripped) as unknown;
      } catch {
        console.warn(
          "[BloomIQ Gemini] Invalid JSON in response:",
          stripped.slice(0, 240)
        );
        return null;
      }

      const parsed = profileSchema.safeParse(normalizeProfileJson(parsedJson));
      if (!parsed.success) {
        console.warn(
          `[BloomIQ Gemini] Schema mismatch (${model})`,
          parsed.error.flatten()
        );
        return null;
      }

      if (process.env.NODE_ENV === "development") {
        console.info(`[BloomIQ Gemini] OK using model: ${model}`);
      }
      return parsed.data;
    }

    console.warn("[BloomIQ Gemini] All model candidates failed or returned unusable JSON.");
    return null;
  } catch (err) {
    console.warn("[BloomIQ Gemini] Request error", err);
    return null;
  }
}
