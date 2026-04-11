function asRecord(doc: unknown): Record<string, unknown> {
  return doc as Record<string, unknown>;
}

function toIso(d: unknown): string | undefined {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string" || typeof d === "number") {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

function toIsoRequired(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  return new Date(String(d)).toISOString();
}

export function serializePlant(doc: unknown) {
  const d = asRecord(doc);
  const id = String(d._id);
  const embedded = d.hasEmbeddedImage === true;
  const externalUrl =
    d.imageUrl != null && String(d.imageUrl).trim() !== ""
      ? String(d.imageUrl)
      : undefined;
  const imageUrl = embedded ? `/api/plants/${id}/image` : externalUrl;
  return {
    _id: id,
    userId: String(d.userId),
    name: String(d.name),
    species: d.species != null ? String(d.species) : undefined,
    location: d.location != null ? String(d.location) : undefined,
    imageUrl,
    notes: d.notes != null ? String(d.notes) : undefined,
    status: String(d.status),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export function serializeCarePlan(doc: unknown) {
  const d = asRecord(doc);
  const last = d.lastCompletedAt;
  return {
    _id: String(d._id),
    userId: String(d.userId),
    plantId: String(d.plantId),
    type: String(d.type),
    frequencyDays: Number(d.frequencyDays),
    startDate: toIsoRequired(d.startDate),
    lastCompletedAt:
      last == null ? null : toIsoRequired(last),
    nextDueAt: toIsoRequired(d.nextDueAt),
    isActive: Boolean(d.isActive),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export function serializeTask(doc: unknown) {
  const d = asRecord(doc);
  const completed = d.completedAt;
  const snoozed = d.snoozedUntil;
  return {
    _id: String(d._id),
    userId: String(d.userId),
    plantId: String(d.plantId),
    carePlanId: String(d.carePlanId),
    type: String(d.type),
    dueAt: toIsoRequired(d.dueAt),
    status: String(d.status),
    completedAt:
      completed == null ? null : toIsoRequired(completed),
    snoozedUntil: snoozed == null ? null : toIsoRequired(snoozed),
    notes: d.notes != null ? String(d.notes) : undefined,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export function serializeActivity(doc: unknown) {
  const d = asRecord(doc);
  const tid = d.taskId;
  return {
    _id: String(d._id),
    userId: String(d.userId),
    plantId: String(d.plantId),
    taskId:
      tid != null && tid !== "" && String(tid) !== "null"
        ? String(tid)
        : null,
    action: String(d.action),
    date: toIsoRequired(d.date),
    notes: d.notes != null ? String(d.notes) : undefined,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}
