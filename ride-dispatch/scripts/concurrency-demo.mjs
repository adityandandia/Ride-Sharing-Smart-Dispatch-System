// Shows why the dispatch transaction needs row locks.
//   npm run demo:concurrency            -> with  FOR UPDATE SKIP LOCKED  (exactly one rider wins)
//   npm run demo:concurrency -- --naive -> without locking                (several riders get the same driver)
import mysql from 'mysql2/promise';

const naive = process.argv.includes('--naive');
const RIDERS = 5;
const cfg = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3307),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? 'rootpass',
  database: process.env.MYSQL_DATABASE ?? 'ridedispatch',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PICKUP = [77.6245, 12.9352]; // Koramangala, right next to driver 10

const admin = await mysql.createConnection(cfg);
const [before] = await admin.query('SELECT driver_id, status FROM drivers');
await admin.query("UPDATE drivers SET status = 'Offline'");
await admin.query("UPDATE drivers SET status = 'Available' WHERE driver_id = 10");
console.log(`Mode: ${naive ? 'NAIVE (no locks)' : 'LOCKED (FOR UPDATE SKIP LOCKED)'}; ${RIDERS} riders request at once, 1 driver is available\n`);

async function rider(n) {
  const c = await mysql.createConnection(cfg);
  await c.beginTransaction();
  const sql = `SELECT driver_id FROM drivers
                WHERE status = 'Available'
                ORDER BY ST_Distance_Sphere(current_location, POINT(?, ?)) LIMIT 1` + (naive ? '' : ' FOR UPDATE SKIP LOCKED');
  const [rows] = await c.query(sql, PICKUP);
  await sleep(400); // pricing, validation, etc. widen the race window
  if (!rows.length) { await c.rollback(); await c.end(); return `rider ${n}: no driver available`; }
  await c.query("UPDATE drivers SET status = 'Busy' WHERE driver_id = ?", [rows[0].driver_id]);
  await c.commit();
  await c.end();
  return `rider ${n}: GOT driver ${rows[0].driver_id}`;
}

const results = await Promise.all(Array.from({ length: RIDERS }, (_, i) => rider(i + 1)));
results.forEach((r) => console.log(r));
const got = results.filter((r) => r.includes('GOT')).length;
console.log(`\n${got} rider(s) were given the single available driver ${got === 1 ? '(correct)' : '(double matching!)'}`);

for (const d of before) await admin.query('UPDATE drivers SET status = ? WHERE driver_id = ?', [d.status, d.driver_id]);
await admin.end();
