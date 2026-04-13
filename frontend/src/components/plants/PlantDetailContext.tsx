"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiPost, type ApiEnvelope } from "@/lib/api";
import {
  ACTIVITY_PAGE_LIMIT,
  readFileAsBase64,
  type ActivitiesPayload,
  type Activity,
  type CarePlan,
  type Plant,
  type SafeUser,
  type TaskRow,
} from "./plant-detail-shared";

type PlantDetailContextValue = {
  plantId: string;
  loading: boolean;
  error: string | null;
  user: SafeUser | null;
  plant: Plant | null;
  setPlant: React.Dispatch<React.SetStateAction<Plant | null>>;
  waterPlan: CarePlan | null;
  activities: Activity[];
  activityPageLoaded: number;
  activityTotalPages: number;
  pendingWaterTask: TaskRow | null;
  busyWater: boolean;
  busyPhoto: boolean;
  noteOpen: boolean;
  setNoteOpen: (v: boolean) => void;
  noteText: string;
  setNoteText: (v: string) => void;
  noteBusy: boolean;
  load: () => Promise<void>;
  markWatered: () => Promise<void>;
  submitNote: () => Promise<void>;
  onPhotoPick: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
};

const PlantDetailContext = createContext<PlantDetailContextValue | null>(null);

export function PlantDetailProvider({
  plantId,
  children,
}: {
  plantId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [waterPlan, setWaterPlan] = useState<CarePlan | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityPageLoaded, setActivityPageLoaded] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [pendingWaterTask, setPendingWaterTask] = useState<TaskRow | null>(
    null
  );
  const [busyWater, setBusyWater] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [
      meRes,
      plantRes,
      plansRes,
      actRes,
      tasksRes,
    ]: [
      ApiEnvelope<SafeUser>,
      ApiEnvelope<Plant>,
      ApiEnvelope<CarePlan[]>,
      ApiEnvelope<ActivitiesPayload>,
      ApiEnvelope<{ items: TaskRow[] }>,
    ] = await Promise.all([
      apiGet<SafeUser>("/api/auth/me"),
      apiGet<Plant>(`/api/plants/${plantId}`),
      apiGet<CarePlan[]>(
        `/api/care-plans?plantId=${encodeURIComponent(plantId)}&isActive=true&type=watering`
      ),
      apiGet<ActivitiesPayload>(
        `/api/activities?plantId=${encodeURIComponent(plantId)}&limit=${ACTIVITY_PAGE_LIMIT}&page=1`
      ),
      apiGet<{ items: TaskRow[] }>(
        `/api/tasks?plantId=${encodeURIComponent(plantId)}&type=watering&status=pending&limit=5`
      ),
    ]);

    if (!meRes.success && meRes.error?.toLowerCase().includes("auth")) {
      router.push("/login");
      return;
    }
    if (!plantRes.success || !plantRes.data) {
      setError(plantRes.error || plantRes.message || "Plant not found.");
      setLoading(false);
      return;
    }
    if (!meRes.success || !meRes.data) {
      setError(meRes.error || "Could not load profile.");
      setLoading(false);
      return;
    }

    const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
    const water = plans.find((p) => p.type === "watering" && p.isActive) ?? null;

    const actPayload = actRes.success && actRes.data ? actRes.data : null;
    const taskItems =
      tasksRes.success && tasksRes.data?.items ? tasksRes.data.items : [];

    setUser(meRes.data);
    setPlant(plantRes.data);
    setWaterPlan(water);
    setActivities(actPayload?.items ?? []);
    setActivityPageLoaded(1);
    setActivityTotalPages(actPayload?.totalPages ?? 1);
    setPendingWaterTask(
      taskItems.find((t) => t.type === "watering" && t.status === "pending") ??
        null
    );
    setLoading(false);
  }, [plantId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const markWatered = useCallback(async () => {
    if (!plant) return;
    setBusyWater(true);
    setError(null);
    try {
      if (pendingWaterTask) {
        const res = await apiPatch<unknown>(
          `/api/tasks/${pendingWaterTask._id}/complete`,
          {}
        );
        if (!res.success) {
          setError(res.error || res.message);
          return;
        }
      } else {
        const res = await apiPost<unknown>("/api/activities", {
          plantId: plant._id,
          action: "watered",
        });
        if (!res.success) {
          setError(res.error || res.message);
          return;
        }
      }
      await load();
    } finally {
      setBusyWater(false);
    }
  }, [plant, pendingWaterTask, load]);

  const submitNote = useCallback(async () => {
    if (!plant || !noteText.trim()) return;
    setNoteBusy(true);
    setError(null);
    try {
      const res = await apiPost<unknown>("/api/activities", {
        plantId: plant._id,
        action: "note_added",
        notes: noteText.trim(),
      });
      if (!res.success) {
        setError(res.error || res.message);
        return;
      }
      setNoteText("");
      setNoteOpen(false);
      await load();
    } finally {
      setNoteBusy(false);
    }
  }, [plant, noteText, load]);

  const onPhotoPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/") || !plant) return;
      setBusyPhoto(true);
      setError(null);
      try {
        const imageBase64 = await readFileAsBase64(file);
        const res = await apiPatch<Plant>(`/api/plants/${plant._id}`, {
          imageBase64,
          imageMimeType: file.type || "application/octet-stream",
        });
        if (!res.success || !res.data) {
          setError(res.error || res.message);
          return;
        }
        setPlant(res.data);
      } finally {
        setBusyPhoto(false);
      }
    },
    [plant]
  );

  const loadMoreHistory = useCallback(async () => {
    const next = activityPageLoaded + 1;
    if (next > activityTotalPages) return;
    const actRes = await apiGet<ActivitiesPayload>(
      `/api/activities?plantId=${encodeURIComponent(plantId)}&limit=${ACTIVITY_PAGE_LIMIT}&page=${next}`
    );
    if (actRes.success && actRes.data?.items?.length) {
      setActivities((prev) => [...prev, ...actRes.data!.items]);
      setActivityPageLoaded(next);
    }
  }, [activityPageLoaded, activityTotalPages, plantId]);

  const value = useMemo<PlantDetailContextValue>(
    () => ({
      plantId,
      loading,
      error,
      user,
      plant,
      setPlant,
      waterPlan,
      activities,
      activityPageLoaded,
      activityTotalPages,
      pendingWaterTask,
      busyWater,
      busyPhoto,
      noteOpen,
      setNoteOpen,
      noteText,
      setNoteText,
      noteBusy,
      load,
      markWatered,
      submitNote,
      onPhotoPick,
      loadMoreHistory,
    }),
    [
      plantId,
      loading,
      error,
      user,
      plant,
      waterPlan,
      activities,
      activityPageLoaded,
      activityTotalPages,
      pendingWaterTask,
      busyWater,
      busyPhoto,
      noteOpen,
      noteText,
      noteBusy,
      load,
      markWatered,
      submitNote,
      onPhotoPick,
      loadMoreHistory,
    ]
  );

  return (
    <PlantDetailContext.Provider value={value}>
      {children}
    </PlantDetailContext.Provider>
  );
}

export function usePlantDetail(): PlantDetailContextValue {
  const ctx = useContext(PlantDetailContext);
  if (!ctx) {
    throw new Error("usePlantDetail must be used within PlantDetailProvider");
  }
  return ctx;
}
