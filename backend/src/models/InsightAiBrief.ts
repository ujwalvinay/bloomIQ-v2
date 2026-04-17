import mongoose, { Schema } from "mongoose";

const insightAiBriefSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    /** Plain text or light markdown; shown on Insights. */
    content: { type: String, trim: true, maxlength: 12000, default: "" },
    /** Last writer: model vs owner edits. */
    contentKind: {
      type: String,
      enum: ["ai", "user_edited"],
      default: "ai",
    },
    /** Fingerprint of dashboard stats when AI last wrote `content`. */
    sourceFingerprint: { type: String, trim: true, maxlength: 128, default: "" },
  },
  { timestamps: true }
);

const InsightAiBrief =
  mongoose.models.InsightAiBrief ??
  mongoose.model("InsightAiBrief", insightAiBriefSchema);

export default InsightAiBrief;
