import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
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
    carePlanId: {
      type: Schema.Types.ObjectId,
      ref: "CarePlan",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["watering", "fertilizing", "pruning"],
      required: true,
    },
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "done", "snoozed", "skipped"],
      default: "pending",
    },
    completedAt: { type: Date, default: null },
    snoozedUntil: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, dueAt: 1, status: 1 });
taskSchema.index({ plantId: 1, dueAt: -1 });
taskSchema.index(
  { carePlanId: 1, dueAt: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

const Task = mongoose.models.Task ?? mongoose.model("Task", taskSchema);

export default Task;
