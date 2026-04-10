import { z } from "zod";
import { objectIdParamSchema } from "./common";

const careTypeEnum = z.enum(["watering", "fertilizing", "pruning"]);

export const createCarePlanBodySchema = z.object({
  plantId: objectIdParamSchema,
  type: careTypeEnum,
  frequencyDays: z.coerce.number().int().min(1),
  startDate: z.coerce.date(),
  lastCompletedAt: z.coerce.date().nullable().optional(),
  nextDueAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const updateCarePlanBodySchema = z
  .object({
    frequencyDays: z.coerce.number().int().min(1).optional(),
    startDate: z.coerce.date().optional(),
    lastCompletedAt: z.coerce.date().nullable().optional(),
    nextDueAt: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const carePlansListQuerySchema = z.object({
  plantId: objectIdParamSchema.optional(),
  type: careTypeEnum.optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
