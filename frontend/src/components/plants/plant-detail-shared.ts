export type SafeUser = { _id: string; name: string; email: string };

export type Plant = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  notes?: string;
  status: string;
  createdAt?: string;
};

export type CarePlan = {
  plantId: string;
  type: string;
  nextDueAt: string;
  isActive: boolean;
};

export type Activity = {
  _id: string;
  action: string;
  date: string;
  notes?: string;
  taskTitle?: string;
  taskId?: string | null;
};

export type TaskRow = {
  _id: string;
  plantId: string;
  type: string;
  status: string;
};

export type ActivitiesPayload = {
  items: Activity[];
  page: number;
  totalPages: number;
};

export const ACTIVITY_PAGE_LIMIT = 20;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function specimenCode(plant: Plant): string {
  const created = plant.createdAt ? new Date(plant.createdAt) : new Date();
  const y = created.getFullYear();
  const m = String(created.getMonth() + 1).padStart(2, "0");
  const prefix =
    plant.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "SPM";
  return `#${prefix}-${y}-${m}`;
}

export function lightLevel(location?: string): string {
  if (!location) return "Bright indirect";
  const l = location.toLowerCase();
  if (l.includes("kitchen") || l.includes("office")) return "Bright indirect";
  if (l.includes("bathroom")) return "Low / indirect";
  if (l.includes("garden") || l.includes("courtyard")) return "Direct sun";
  if (l.includes("bedroom") || l.includes("living")) return "Bright indirect";
  return "Bright indirect";
}

export function healthHeadline(status: string): string {
  if (status === "archived") return "Archived";
  if (status === "needs_attention") return "Needs attention";
  return "Thriving";
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function wateringSummary(nextDueIso: string | undefined): string {
  if (!nextDueIso) return "No schedule";
  const d = daysUntil(nextDueIso);
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

export function careTips(species?: string, name?: string): {
  watering: string;
  sunlight: string;
  fertilizer: string;
  temperature: string;
} {
  const s = `${species ?? ""} ${name ?? ""}`.toLowerCase();
  if (s.includes("fiddle") || s.includes("ficus") || s.includes("lyrata")) {
    return {
      watering:
        "Allow top 2 inches of soil to dry out between waterings. Use lukewarm filtered water.",
      sunlight:
        "Place in front of an east-facing window. Rotate monthly for even growth.",
      fertilizer:
        "Feed once a month during spring and summer with organic leaf-heavy food.",
      temperature:
        "Maintain between 65°F – 75°F. Keep away from air conditioning drafts.",
    };
  }
  if (s.includes("monstera")) {
    return {
      watering:
        "Water when the top few inches of soil feel dry; avoid soggy roots.",
      sunlight:
        "Bright, indirect light; a few hours of gentle morning sun is welcome.",
      fertilizer:
        "Balanced liquid fertilizer every 4–6 weeks in the growing season.",
      temperature:
        "Prefers 65°F – 80°F; protect from cold drafts below 55°F.",
    };
  }
  if (
    s.includes("snake") ||
    s.includes("sansevieria") ||
    s.includes("dracaena")
  ) {
    return {
      watering:
        "Water sparingly; let soil dry completely between deep drinks.",
      sunlight:
        "Tolerates low light; brighter indirect light speeds growth.",
      fertilizer:
        "Light feeding once in spring and once in summer is plenty.",
      temperature:
        "Average room temperatures; avoid frost and wet feet in winter.",
    };
  }
  return {
    watering:
      "Water when the top inch of soil dries; empty drainage trays after watering.",
    sunlight:
      "Bright indirect light suits most houseplants; avoid harsh midday sun.",
    fertilizer:
      "Use a balanced houseplant food every 4–8 weeks while actively growing.",
    temperature:
      "Most specimens prefer 65°F – 78°F away from heaters and cold windows.",
  };
}

export function activityHeadline(a: Activity): string {
  switch (a.action) {
    case "watered":
      return "Watered";
    case "fertilized":
      return "Fertilized";
    case "pruned":
      return "Pruned";
    case "note_added":
      return a.notes?.split("\n")[0]?.slice(0, 48) || "Note added";
    case "task_skipped":
      return "Task skipped";
    case "task_snoozed":
      return "Task snoozed";
    case "custom_task_done": {
      const t = a.taskTitle?.trim();
      if (t) return t;
      const line = a.notes?.split("\n")[0]?.trim();
      if (line) return line.slice(0, 200);
      return "Custom task";
    }
    default:
      return "Care event";
  }
}

export function activityBlurb(a: Activity): string {
  if (a.action === "custom_task_done") {
    const n = a.notes?.trim();
    const t = a.taskTitle?.trim();
    if (n && n !== t) return n;
    return "Marked complete from your task list.";
  }
  if (a.notes?.trim()) return a.notes.trim();
  switch (a.action) {
    case "watered":
      return "Recorded in your conservatory log.";
    case "fertilized":
      return "Nutrients added to support steady growth.";
    default:
      return "Logged in your botanical archive.";
  }
}

export function healthSeries(status: string, seed: string): number[] {
  const base =
    status === "healthy" ? 90 : status === "needs_attention" ? 74 : 62;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 6 }, (_, i) => {
    const pseudo = ((h + i * 17) % 11) - 5;
    const wave = Math.sin(i * 0.75) * 5;
    return Math.min(100, Math.max(52, Math.round(base + wave + pseudo)));
  });
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
}

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"] as const;
