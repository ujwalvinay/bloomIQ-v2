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
    /** Profile photo bytes; use GET /api/auth/me/avatar to read. */
    avatarData: { type: Buffer, select: false },
    avatarMimeType: { type: String, trim: true, maxlength: 80, select: false },
    hasAvatar: { type: Boolean, default: false },
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

userSchema.pre("save", function (next) {
  if (!this.isModified("avatarData")) {
    next();
    return;
  }
  const buf = this.get("avatarData") as Buffer | undefined;
  const has = Buffer.isBuffer(buf) && buf.length > 0;
  this.set("hasAvatar", has);
  next();
});

userSchema.set("toJSON", {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(_doc: unknown, ret: Record<string, unknown>) {
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.models.User ?? mongoose.model("User", userSchema);

export default User;
