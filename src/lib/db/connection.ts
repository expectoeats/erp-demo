import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define MONGODB_URI in environment variables");
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      // bufferCommands: true (default) — lets Mongoose queue operations while
      // the connection is being established instead of throwing immediately.
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 15000, // give Atlas free-tier enough warm-up time
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => {
      cached.conn = m;
      return m;
    }).catch((err) => {
      cached.promise = null; // reset so the next request can retry
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
