export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import {
  errorResponse,
  formatZodError,
  handleServerError,
  parseJsonBody,
  successResponse,
} from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getZonedDayBounds, getZonedWeekBounds } from "@/lib/care-utils";
import { connectToDatabase } from "@/lib/db";
import { fetchGeminiInsightsBrief } from "@/lib/gemini-insights-brief";
import {
  buildInsightsStatsFingerprint,
  type InsightsStatsFingerprintInput,
} from "@/lib/insights-fingerprint";
import InsightAiBrief from "@/models/InsightAiBrief";
import Plant from "@/models/Plant";
import Task from "@/models/Task";

const patchBodySchema = z.object({
  content: z.string().trim().min(1).max(12000),
});

const postBodySchema = z
  .object({
    regenerate: z.boolean().optional(),
  })
  .optional()
  .default({});

async function loadDashboardFingerprintBlock(
  userId: Types.ObjectId,
  timezone: string
): Promise<{
  stats: InsightsStatsFingerprintInput & { timezone: string };
  fingerprint: string;
}> {
  const { startUtc: dayStart, endUtc: dayEnd } = getZonedDayBounds(timezone);
  const { weekStartUtc, weekEndUtc } = getZonedWeekBounds(timezone);

  const [
    totalPlants,
    healthyPlants,
    needsAttentionPlants,
    tasksDueToday,
    overdueTasks,
    completedThisWeek,
    distinctLocations,
  ] = await Promise.all([
    Plant.countDocuments({ userId }),
    Plant.countDocuments({ userId, status: "healthy" }),
    Plant.countDocuments({ userId, status: "needs_attention" }),
    Task.countDocuments({
      userId,
      status: "pending",
      dueAt: { $gte: dayStart, $lte: dayEnd },
    }),
    Task.countDocuments({
      userId,
      status: "pending",
      dueAt: { $lt: dayStart },
    }),
    Task.countDocuments({
      userId,
      status: { $in: ["completed", "done"] },
      completedAt: {
        $gte: weekStartUtc,
        $lte: weekEndUtc,
      },
    }),
    Plant.distinct("location", {
      userId,
      location: { $nin: [null, ""] },
    }),
  ]);

  const stats: InsightsStatsFingerprintInput & { timezone: string } = {
    totalPlants,
    healthyPlants,
    needsAttentionPlants,
    livingZones: distinctLocations.length,
    tasksDueToday,
    overdueTasks,
    completedThisWeek,
    timezone,
  };

  const { timezone: _tz, ...forHash } = stats;
  const fingerprint = buildInsightsStatsFingerprint(forHash);

  return { stats, fingerprint };
}

async function loadPlantsSample(userId: Types.ObjectId) {
  const needs = await Plant.find({
    userId,
    status: "needs_attention",
  })
    .sort({ updatedAt: -1 })
    .limit(8)
    .select({ name: 1, species: 1, location: 1, status: 1 })
    .lean();

  const rest = await Plant.find({
    userId,
    status: { $ne: "needs_attention" },
  })
    .sort({ updatedAt: -1 })
    .limit(Math.max(0, 12 - needs.length))
    .select({ name: 1, species: 1, location: 1, status: 1 })
    .lean();

  const merged = [...needs, ...rest].slice(0, 12);
  return merged.map((p) => ({
    name: String(p.name ?? ""),
    species: p.species ? String(p.species) : undefined,
    location: p.location ? String(p.location) : undefined,
    status: String(p.status ?? ""),
  }));
}

export async function GET(_request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const userId = new Types.ObjectId(auth.user._id);
    const timezone = auth.user.timezone;

    const [{ stats, fingerprint }, doc] = await Promise.all([
      loadDashboardFingerprintBlock(userId, timezone),
      InsightAiBrief.findOne({ userId }).lean(),
    ]);

    const row = doc as
      | {
          content?: string;
          contentKind?: string;
          sourceFingerprint?: string;
          updatedAt?: Date;
          createdAt?: Date;
        }
      | null;

    const content = row?.content?.trim() ?? "";
    const contentKind =
      row?.contentKind === "user_edited" ? "user_edited" : "ai";
    const sourceFingerprint = row?.sourceFingerprint?.trim() ?? "";

    return successResponse("Insight AI brief", {
      content: content || null,
      contentKind: row ? contentKind : null,
      sourceFingerprint: sourceFingerprint || null,
      currentFingerprint: fingerprint,
      isStale: Boolean(
        sourceFingerprint && sourceFingerprint !== fingerprint
      ),
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      statsPreview: {
        totalPlants: stats.totalPlants,
        tasksDueToday: stats.tasksDueToday,
        overdueTasks: stats.overdueTasks,
      },
    });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = postBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const userId = new Types.ObjectId(auth.user._id);
    const timezone = auth.user.timezone;

    const [{ stats, fingerprint }, plantsSample] = await Promise.all([
      loadDashboardFingerprintBlock(userId, timezone),
      loadPlantsSample(userId),
    ]);

    const brief = await fetchGeminiInsightsBrief({
      stats,
      plantsSample,
    });

    if (!brief) {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!key?.trim()) {
        return errorResponse(
          "Unavailable",
          "AI insights are not configured (set GEMINI_API_KEY or GOOGLE_API_KEY on the server).",
          503
        );
      }
      return errorResponse(
        "Unavailable",
        "The AI could not generate a brief right now. Try again shortly.",
        503
      );
    }

    const updated = await InsightAiBrief.findOneAndUpdate(
      { userId },
      {
        $set: {
          content: brief,
          contentKind: "ai",
          sourceFingerprint: fingerprint,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return successResponse("Brief generated", {
      content: updated.content,
      contentKind: updated.contentKind,
      sourceFingerprint: updated.sourceFingerprint,
      currentFingerprint: fingerprint,
      isStale: false,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();
    const auth = await requireAuth(request);
    if (!("user" in auth)) return auth;

    const raw = await parseJsonBody<unknown>(request);
    if (!raw.ok) {
      return errorResponse("Invalid request", raw.error, 400);
    }
    const parsed = patchBodySchema.safeParse(raw.data);
    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        formatZodError(parsed.error),
        422
      );
    }

    const userId = new Types.ObjectId(auth.user._id);
    const timezone = auth.user.timezone;
    const { fingerprint } = await loadDashboardFingerprintBlock(
      userId,
      timezone
    );

    const updated = await InsightAiBrief.findOneAndUpdate(
      { userId },
      {
        $set: {
          content: parsed.data.content,
          contentKind: "user_edited",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return successResponse("Brief saved", {
      content: updated.content,
      contentKind: updated.contentKind,
      sourceFingerprint: updated.sourceFingerprint || null,
      currentFingerprint: fingerprint,
      isStale: Boolean(
        updated.sourceFingerprint &&
          updated.sourceFingerprint !== fingerprint
      ),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    return handleServerError(err);
  }
}
