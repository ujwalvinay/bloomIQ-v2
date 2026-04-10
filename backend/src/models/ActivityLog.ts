import mongoose, { Schema } from "mongoose";

const activityLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plantId: {
      type: Schema.Types.ObjectId,
      ref: "Plant",
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    action: {
      type: String,
      enum: [
        "watered",
        "fertilized",
        "pruned",
        "note_added",
        "task_skipped",
        "task_snoozed",
      ],
      required: true,
    },
    date: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

activityLogSchema.index({ plantId: 1, date: -1 });
activityLogSchema.index({ userId: 1, date: -1 });

const ActivityLog =
  mongoose.models.ActivityLog ??
  mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
