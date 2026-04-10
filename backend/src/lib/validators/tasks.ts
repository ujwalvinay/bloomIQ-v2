import { z } from "zod";
import { objectIdParamSchema, paginationQuerySchema } from "./common";

const taskStatusEnum = z.enum(["pending", "done", "snoozed", "skipped"]);
const careTypeEnum = z.enum(["watering", "fertilizing", "pruning"]);

export const tasksListQuerySchema = paginationQuerySchema.extend({
  status: taskStatusEnum.optional(),
  type: careTypeEnum.optional(),
  plantId: objectIdParamSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const snoozeTaskBodySchema = z
  .object({
    snoozedUntil: z.coerce.date().optional(),
    snoozeDays: z.coerce.number().int().min(1).max(365).optional(),
  })
  .refine((v) => v.snoozedUntil != null || v.snoozeDays != null, {
    message: "Provide snoozedUntil or snoozeDays",
  });

const activityActionEnum = z.enum([
  "watered",
  "fertilized",
  "pruned",
  "note_added",
  "task_skipped",
  "task_snoozed",
]);

export const createActivityBodySchema = z.object({
  plantId: objectIdParamSchema,
  taskId: objectIdParamSchema.optional(),
  action: activityActionEnum,
  date: z.coerce.date().optional(),
  notes: z.string().max(5000).optional(),
});

export const activitiesListQuerySchema = paginationQuerySchema.extend({
  plantId: objectIdParamSchema.optional(),
  action: activityActionEnum.optional(),
});

export const taskNotesBodySchema = z
  .object({
    notes: z.string().max(5000).optional(),
  })
  .strict();
