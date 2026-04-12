import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    passwordResetTokenHash: {
      type: String,
      select: false,
      sparse: true,
      unique: true,
    },
    passwordResetExpiresAt: { type: Date, select: false },
    timezone: { type: String, default: "Asia/Kolkata", trim: true },
    notificationEnabled: { type: Boolean, default: true },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: unknown, ret: Record<string, unknown>) {
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.models.User ?? mongoose.model("User", userSchema);

export default User;
