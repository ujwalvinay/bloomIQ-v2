import { z } from "zod";
import { PLANT_LIGHT_LEVELS } from "@/lib/gemini-plant-profile";
import { paginationQuerySchema } from "./common";

const plantStatusEnum = z.enum(["healthy", "needs_attention", "archived"]);
const plantLightLevelEnum = z.enum(PLANT_LIGHT_LEVELS);

const careGuidePatchSchema = z
  .object({
    watering: z.string().max(2500).optional(),
    sunlight: z.string().max(2500).optional(),
    fertilizer: z.string().max(2500).optional(),
    temperature: z.string().max(2500).optional(),
  })
  .strict();

export const createPlantBodySchema = z.object({
  name: z.string().min(1).max(200),
  species: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  imageUrl: z
    .union([z.string().url().max(2000), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  /** Raw base64 (no data: prefix). Prefer this over multipart when using a dev proxy that drops FormData bodies. */
  imageBase64: z.string().max(6_500_000).optional(),
  imageMimeType: z.string().max(80).optional(),
  notes: z.string().max(5000).optional(),
  status: plantStatusEnum.optional(),
});

export const updatePlantBodySchema = createPlantBodySchema
  .partial()
  .extend({
    lightLevel: plantLightLevelEnum.optional(),
    careRequirements: z.string().max(8000).optional(),
    careGuide: careGuidePatchSchema.optional(),
  });

export const plantsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
  status: plantStatusEnum.optional(),
  /** Case-insensitive exact match against stored `location`. */
  location: z.string().max(200).optional(),
  sort: z.enum(["recent", "name", "watering"]).optional().default("recent"),
  /** Pass `true` to include archived plants (default: archived are omitted). */
  includeArchived: z
    .union([
      z.literal("true"),
      z.literal("false"),
      z.literal("1"),
      z.literal("0"),
    ])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});
