import mysql, { RowDataPacket } from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var _mysqlPool: mysql.Pool | undefined;
}

export const pool: mysql.Pool =
  global._mysqlPool ??
  mysql.createPool({
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3307),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? 'rootpass',
    database: process.env.MYSQL_DATABASE ?? 'ridedispatch',
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true, // DECIMAL columns come back as numbers
  });

if (process.env.NODE_ENV !== 'production') global._mysqlPool = pool;

export type Queryable = mysql.Pool | mysql.PoolConnection;

/** Run a parameterised query (placeholders only: protects against SQL injection). */
export async function q<T = any>(sql: string, params: any[] = [], conn: Queryable = pool): Promise<T[]> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

export async function q1<T = any>(sql: string, params: any[] = [], conn: Queryable = pool): Promise<T | undefined> {
  return (await q<T>(sql, params, conn))[0];
}
