import mongoose, { Schema } from "mongoose";

const carePlanSchema = new Schema(
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
    type: {
      type: String,
      enum: ["watering", "fertilizing", "pruning"],
      required: true,
    },
    frequencyDays: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    lastCompletedAt: { type: Date, default: null },
    nextDueAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

carePlanSchema.index({ plantId: 1, type: 1, isActive: 1 });
carePlanSchema.index({ userId: 1, nextDueAt: 1 });
carePlanSchema.index(
  { plantId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  }
);

const CarePlan =
  mongoose.models.CarePlan ?? mongoose.model("CarePlan", carePlanSchema);

export default CarePlan;
