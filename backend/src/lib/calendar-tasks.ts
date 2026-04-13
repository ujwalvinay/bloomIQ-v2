import { serializeTask } from "@/lib/serializers";

type PlantPop = { name?: string; location?: string };

export function taskDisplayTitle(
  type: string,
  plantName: string,
  customTitle?: string
): string {
  if (type === "custom") {
    const t = customTitle?.trim();
    return t && t.length > 0 ? t : "Custom task";
  }
  const plant = plantName || "plant";
  if (type === "watering") return `Water the ${plant}`;
  if (type === "fertilizing") return `Fertilize ${plant}`;
  if (type === "pruning") return `Prune ${plant}`;
  return `Care for ${plant}`;
}

export function plantFromPopulate(plantId: unknown): {
  name: string;
  location?: string;
} {
  if (plantId && typeof plantId === "object" && "name" in plantId) {
    const p = plantId as PlantPop;
    return {
      name: String(p.name ?? "Plant"),
      location: p.location != null ? String(p.location) : undefined,
    };
  }
  return { name: "Plant" };
}

export function toCalendarTaskRow(doc: unknown) {
  const ser = serializeTask(doc);
  const d = doc as { plantId?: unknown };
  const { name, location } = plantFromPopulate(d.plantId);
  const plantLine =
    location?.trim() ? `${name} • ${location.trim()}` : name;
  return {
    ...ser,
    plantName: name,
    plantLocation: location,
    plantLine,
    displayTitle: taskDisplayTitle(ser.type, name, ser.title),
  };
}
