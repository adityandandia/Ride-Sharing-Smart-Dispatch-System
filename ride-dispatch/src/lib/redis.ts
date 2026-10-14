import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined;
}

export const redis: Redis =
  global._redis ?? new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: 2 });

if (process.env.NODE_ENV !== 'production') global._redis = redis;

export const driverLocKey = (id: number) => `driver:loc:${id}`;
export const sessionKey = (jti: string) => `session:${jti}`;

export type LiveLocation = { lat: number; lng: number; ts: number };

export async function getLiveLocation(driverId: number): Promise<LiveLocation | null> {
  const raw = await redis.get(driverLocKey(driverId));
  return raw ? (JSON.parse(raw) as LiveLocation) : null;
}
