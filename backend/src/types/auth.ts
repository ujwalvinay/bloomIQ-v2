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
  createdAt: string;
  updatedAt: string;
};
