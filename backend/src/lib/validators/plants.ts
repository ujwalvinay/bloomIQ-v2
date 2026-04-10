import { z } from "zod";
import { paginationQuerySchema } from "./common";

const plantStatusEnum = z.enum(["healthy", "needs_attention", "archived"]);

export const createPlantBodySchema = z.object({
  name: z.string().min(1).max(200),
  species: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  imageUrl: z
    .union([z.string().url().max(2000), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  notes: z.string().max(5000).optional(),
  status: plantStatusEnum.optional(),
});

export const updatePlantBodySchema = createPlantBodySchema.partial();

export const plantsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
  status: plantStatusEnum.optional(),
});
