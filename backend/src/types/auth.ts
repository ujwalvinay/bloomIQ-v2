export type AccessTokenPayload = {
  sub: string;
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  tv: number;
};

export type SafeUser = {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  notificationEnabled: boolean;
  /** Same-origin path to load bytes (use backend absolute URL in <img> when needed). */
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
