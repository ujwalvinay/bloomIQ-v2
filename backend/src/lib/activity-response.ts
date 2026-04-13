import { Types } from "mongoose";
import Task from "@/models/Task";
import { serializeActivity } from "./serializers";

export type SerializedActivity = ReturnType<typeof serializeActivity>;

/**
 * Fills `taskTitle` for `custom_task_done` rows that predate snapshotting the
 * title on the activity, by reading the linked Task (same user).
 */
export async function serializeActivitiesWithResolvedTaskTitles(
  rawDocs: unknown[],
  userId: Types.ObjectId
): Promise<SerializedActivity[]> {
  const items = rawDocs.map(serializeActivity);
  const needLookup = items.filter(
    (s) =>
      s.action === "custom_task_done" &&
      !(s.taskTitle && String(s.taskTitle).trim()) &&
      s.taskId
  );
  if (needLookup.length === 0) return items;

  const ids = [...new Set(needLookup.map((s) => s.taskId!))].map(
    (id) => new Types.ObjectId(id)
  );
  const tasks = await Task.find({
    _id: { $in: ids },
    userId,
  })
    .select({ title: 1 })
    .lean();

  const titleByTaskId = new Map<string, string>();
  for (const t of tasks) {
    const raw = (t as { title?: unknown }).title;
    const title =
      raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    if (title) titleByTaskId.set(String(t._id), title);
  }

  return items.map((s) => {
    if (s.action !== "custom_task_done") return s;
    if (s.taskTitle && String(s.taskTitle).trim()) return s;
    if (!s.taskId) return s;
    const t = titleByTaskId.get(s.taskId);
    return t ? { ...s, taskTitle: t } : s;
  });
}
