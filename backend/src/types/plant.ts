export type PlantStatus = "healthy" | "needs_attention" | "archived";

export type CarePlanType = "watering" | "fertilizing" | "pruning";

export type TaskStatus =
  | "pending"
  | "completed"
  | "done"
  | "snoozed"
  | "skipped";

export type ActivityAction =
  | "watered"
  | "fertilized"
  | "pruned"
  | "note_added"
  | "task_skipped"
  | "task_snoozed"
  | "custom_task_done";
