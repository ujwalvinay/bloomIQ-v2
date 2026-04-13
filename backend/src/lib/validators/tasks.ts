import { z } from "zod";
import { objectIdParamSchema, paginationQuerySchema } from "./common";

const taskStatusEnum = z.enum([
  "pending",
  "completed",
  "done",
  "snoozed",
  "skipped",
]);
const taskTypeEnum = z.enum(["watering", "fertilizing", "pruning", "custom"]);

export const tasksListQuerySchema = paginationQuerySchema.extend({
  status: taskStatusEnum.optional(),
  type: taskTypeEnum.optional(),
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
  "custom_task_done",
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

const dueDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createCustomTaskBodySchema = z
  .object({
    plantId: objectIdParamSchema,
    title: z.string().trim().min(1).max(200),
    dueDate: dueDateStringSchema,
    notes: z.string().trim().max(5000).optional(),
  })
  .strict();

export const calendarDayQuerySchema = z.object({
  date: dueDateStringSchema,
});

export const calendarRangeQuerySchema = z
  .object({
    from: dueDateStringSchema,
    to: dueDateStringSchema,
  })
  .refine((q) => q.from <= q.to, {
    message: "`from` must be on or before `to`",
    path: ["to"],
  })
  .refine((q) => {
    const [fy, fm, fd] = q.from.split("-").map(Number);
    const [ty, tm, td] = q.to.split("-").map(Number);
    const a = new Date(Date.UTC(fy, fm - 1, fd));
    const b = new Date(Date.UTC(ty, tm - 1, td));
    const days = (b.getTime() - a.getTime()) / 86400000;
    return days <= 93;
  }, {
    message: "Date range cannot exceed 94 days",
    path: ["to"],
  });
