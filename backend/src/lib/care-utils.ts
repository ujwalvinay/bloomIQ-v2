import {
  addDays,
  endOfDay,
  endOfWeek,
  isAfter,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { ClientSession, Types } from "mongoose";
import Task from "@/models/Task";
import type { ActivityAction, CarePlanType } from "@/types/plant";

export function careTypeToCompletedActivity(type: CarePlanType): ActivityAction {
  switch (type) {
    case "watering":
      return "watered";
    case "fertilizing":
      return "fertilized";
    case "pruning":
      return "pruned";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Returns UTC instants for the user's local calendar day [start, end].
 */
export function getZonedDayBounds(
  timezone: string,
  referenceUtc: Date = new Date()
): { startUtc: Date; endUtc: Date } {
  const zoned = toZonedTime(referenceUtc, timezone);
  const localStart = startOfDay(zoned);
  const localEnd = endOfDay(zoned);
  return {
    startUtc: fromZonedTime(localStart, timezone),
    endUtc: fromZonedTime(localEnd, timezone),
  };
}

export function getZonedWeekBounds(
  timezone: string,
  referenceUtc: Date = new Date()
): { weekStartUtc: Date; weekEndUtc: Date } {
  const zoned = toZonedTime(referenceUtc, timezone);
  const localWeekStart = startOfWeek(zoned, { weekStartsOn: 1 });
  const localWeekEnd = endOfWeek(zoned, { weekStartsOn: 1 });
  return {
    weekStartUtc: fromZonedTime(localWeekStart, timezone),
    weekEndUtc: fromZonedTime(localWeekEnd, timezone),
  };
}

/**
 * Next occurrence after a completion: lastCompleted + frequencyDays (calendar days, UTC-safe).
 */
export function computeNextDueAfterCompletion(
  lastCompletedAt: Date,
  frequencyDays: number
): Date {
  return addDays(lastCompletedAt, frequencyDays);
}

/**
 * Initial next due when creating a plan: align to startDate (start of that day in user TZ).
 */
export function computeInitialNextDueAt(
  startDate: Date,
  timezone: string
): Date {
  const zoned = toZonedTime(startDate, timezone);
  const localStart = startOfDay(zoned);
  return fromZonedTime(localStart, timezone);
}

export function isDueOnOrBeforeEndOfUserDay(
  dueAt: Date,
  timezone: string,
  referenceUtc: Date = new Date()
): boolean {
  const { endUtc } = getZonedDayBounds(timezone, referenceUtc);
  return !isAfter(dueAt, endUtc);
}

/** Start of the local calendar day N days from now (user timezone). */
export function computeSnoozeUntilFromDays(
  timezone: string,
  snoozeDays: number,
  referenceUtc: Date = new Date()
): Date {
  const zoned = toZonedTime(referenceUtc, timezone);
  const targetLocal = startOfDay(addDays(zoned, snoozeDays));
  return fromZonedTime(targetLocal, timezone);
}

/**
 * Creates a pending task if none exists for this care plan + dueAt (exact match).
 */
export async function ensurePendingTask(params: {
  userId: Types.ObjectId;
  plantId: Types.ObjectId;
  carePlanId: Types.ObjectId;
  type: CarePlanType;
  dueAt: Date;
  session?: ClientSession | null;
}): Promise<void> {
  const q = Task.findOne({
    carePlanId: params.carePlanId,
    status: "pending",
    dueAt: params.dueAt,
  });
  if (params.session) q.session(params.session);
  const existing = await q.lean();

  if (existing) return;

  try {
    const docs = [
      {
        userId: params.userId,
        plantId: params.plantId,
        carePlanId: params.carePlanId,
        type: params.type,
        dueAt: params.dueAt,
        status: "pending" as const,
      },
    ];
    if (params.session) {
      await Task.create(docs, { session: params.session });
    } else {
      await Task.create(docs);
    }
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: number }).code
        : undefined;
    if (code === 11000) return;
    throw err;
  }
}

export async function advanceCarePlanAfterCompletion(params: {
  carePlan: {
    frequencyDays: number;
    lastCompletedAt: Date | null;
    nextDueAt: Date;
    save: (opts?: { session?: ClientSession | null }) => Promise<unknown>;
  };
  completedAt: Date;
  session?: ClientSession | null;
}): Promise<Date> {
  const { carePlan, completedAt, session } = params;
  const nextDue = computeNextDueAfterCompletion(
    completedAt,
    carePlan.frequencyDays
  );
  carePlan.lastCompletedAt = completedAt;
  carePlan.nextDueAt = nextDue;
  await carePlan.save(session ? { session } : undefined);
  return nextDue;
}
