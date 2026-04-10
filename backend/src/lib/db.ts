import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var -- global cache for dev HMR
  var __bloomiqMongoose: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__bloomiqMongoose ?? {
  conn: null,
  promise: null,
};

if (process.env.NODE_ENV !== "production") {
  globalThis.__bloomiqMongoose = cache;
}

/**
 * Reuses a single Mongoose connection across hot reloads in development.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set");
    }
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri);
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
