# Dispatch: Ride-Sharing & Smart Dispatch System
DBMS Level 3 project, PES University. MySQL 8 (relational + spatial) · Redis (NoSQL) · ChromaDB (vector) · Next.js 14.

## 1. Run it (Windows, Docker Desktop running)
```powershell
docker compose up -d          # MySQL :3307, Redis :6379, ChromaDB :8000 (SQL files in /db run automatically on first start)
npm install
copy .env.local.example .env.local
npm run dev                   # http://localhost:3000
```
- Reset the database from scratch: `docker compose down -v` then `docker compose up -d`
- First login as `admin@ride.test`, open the Admin page, and click **Re-index complaints** once (downloads a small embedding model the first time).

Demo accounts (password `password123`): `admin@ride.test`, `rider1@ride.test` to `rider3@ride.test`, `driver1@ride.test` to `driver8@ride.test`.

## 2. Try the full flow
1. Browser A: sign in as `driver1@ride.test`, click **Go online**, tap the map near Koramangala.
2. Browser B (another profile or private window): sign in as `rider1@ride.test`, tap pickup then drop-off, **Request ride**.
3. Driver: **Start trip**, then **Complete trip**. Rider: rate the driver and optionally report a problem.
4. Admin: change pricing or the surge override, then search disputes ("overcharged for a longer route").

## 3. Proposal requirement → where it lives
| Requirement | File |
|---|---|
| 3NF schema, FK and CHECK constraints | `db/01_schema.sql` |
| `SPATIAL INDEX` on POINT, KNN with `ST_Distance_Sphere` | `db/01_schema.sql`, `src/app/api/rider/trips/route.ts` |
| Redis driver tracking `driver:loc:<id>` and sessions | `src/app/api/driver/location/route.ts`, `src/lib/redis.ts`, `src/lib/auth.ts` |
| Transaction + `FOR UPDATE` against double matching | `src/app/api/rider/trips/route.ts` (`POST`) |
| Triggers (Busy on trip insert, rating recalculation) | `db/02_triggers.sql` |
| `calculate_fare` stored procedure (plus `compute_surge`) | `db/03_procedures.sql` |
| Vector search over complaints | `src/lib/vector.ts`, `src/app/api/admin/disputes/*` |
| RBAC (Rider, Driver, Admin) | `src/middleware.ts` (pages), `requireAuth()` in `src/lib/auth.ts` (APIs) |
| Zod validation, bcrypt, SQL-injection protection | `src/lib/validators.ts`, `bcryptjs` in auth routes, parameterised queries everywhere |
| ER diagram | `docs/ER_diagram.mermaid` |

## 4. Concurrency demo (good for the viva)
```powershell
npm run demo:concurrency -- --naive   # no locks: several riders receive the same driver
npm run demo:concurrency              # FOR UPDATE SKIP LOCKED: exactly one rider wins
```

## 5. Design notes to mention in your report
- **Spatial:** points are stored as SRID 0 `POINT(longitude, latitude)`; `ST_Distance_Sphere` treats x as longitude and y as latitude and returns metres. MySQL only uses a spatial index with MBR functions, so the query shortlists with `MBRContains` on a bounding box (index) and ranks the survivors by true distance.
- **Locking:** `FOR UPDATE OF d SKIP LOCKED` locks the chosen driver row; a competing rider skips it and gets the next driver instead of waiting.
- **Redis vs MySQL:** every GPS ping goes to Redis (2 min TTL). MySQL's spatial column is refreshed at most every 15 s per driver (a Redis `NX` key throttles it), so matching stays accurate without a write per ping.
- **Sessions:** the cookie holds a signed JWT with a session id; the session itself lives in Redis, so logout truly revokes it.
- **3NF:** `reviews` has no `driver_id` (derived through `trips`). `trips.fare` is kept deliberately as a historical price snapshot, because changing the pricing table must not rewrite old trips.
- **Embeddings:** there is no OpenAI key, so ChromaDB's local MiniLM model (384 dimensions) is used instead of 1536-dimension `text-embedding-3-small`. To switch, install `@chroma-core/openai`, change one line in `src/lib/vector.ts`, delete the `chromadata` volume and re-index.
- **Surge:** demand-based (trips requested in the last 10 minutes divided by available drivers, capped at 3x), unless the admin sets an override.

## 6. Troubleshooting
- `ECONNREFUSED 3307`: MySQL is still starting; wait 20 s after the first `docker compose up`.
- SQL files did not run: they execute only on first start of an empty volume; use `docker compose down -v`.
- Port 3000 busy: `npm run dev -- -p 3001`.
- Admin search returns nothing: click **Re-index complaints**.
