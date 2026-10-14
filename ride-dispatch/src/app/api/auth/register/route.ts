import bcrypt from 'bcryptjs';
import { body, handle, createSession } from '@/lib/auth';
import { pool } from '@/lib/db';
import { registerSchema } from '@/lib/validators';

export const POST = handle(async (req) => {
  const d = await body(req, registerSchema);
  const hash = await bcrypt.hash(d.password, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res]: any = await conn.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [d.name, d.email, d.phone ?? null, hash, d.role]
    );
    const id = res.insertId as number;
    if (d.role === 'Rider') {
      await conn.query('INSERT INTO riders (rider_id) VALUES (?)', [id]);
    } else {
      // new drivers start Offline at the Bengaluru city centre until they share a location
      await conn.query(
        "INSERT INTO drivers (driver_id, license_no, status, current_location) VALUES (?,?, 'Offline', POINT(77.5946, 12.9716))",
        [id, d.licenseNo]
      );
      await conn.query('INSERT INTO vehicles (driver_id, plate_no, model, vehicle_type, seats) VALUES (?,?,?,?,?)', [
        id, d.vehicle!.plateNo, d.vehicle!.model, d.vehicle!.type, d.vehicle!.seats,
      ]);
    }
    await conn.commit();
    await createSession(id, d.role);
    return { ok: true, role: d.role };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});
