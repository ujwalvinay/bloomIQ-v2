import mongoose, { Schema } from "mongoose";

const plantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    species: { type: String, trim: true, maxlength: 200 },
    location: { type: String, trim: true, maxlength: 200 },
    imageUrl: { type: String, trim: true, maxlength: 2000 },
    /** Raw bytes when the user uploads a portrait; not selected by default in queries. */
    imageData: { type: Buffer, select: false },
    imageMimeType: { type: String, trim: true, maxlength: 80, select: false },
    hasEmbeddedImage: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["healthy", "needs_attention", "archived"],
      default: "healthy",
    },
  },
  { timestamps: true }
);

plantSchema.index({ userId: 1, createdAt: -1 });

plantSchema.pre("save", function (next) {
  const buf = this.get("imageData") as Buffer | undefined;
  const has =
    Buffer.isBuffer(buf) && buf.length > 0;
  this.set("hasEmbeddedImage", has);
  next();
});

const Plant = mongoose.models.Plant ?? mongoose.model("Plant", plantSchema);

export default Plant;
