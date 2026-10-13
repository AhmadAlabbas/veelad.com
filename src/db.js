import mysql from 'mysql2/promise';
export function database(c) {
  const pool = mysql.createPool(c.db);
  async function q(sql,args=[],connection=pool) { const [rows] = await connection.execute(sql,args); return rows; }
  async function one(sql,args=[],connection=pool) { return (await q(sql,args,connection))[0] || null; }
  async function tx(fn) {
    const connection=await pool.getConnection();
    try {await connection.beginTransaction(); const result=await fn(connection); await connection.commit(); return result;}
    catch(e) {await connection.rollback(); throw e;} finally {connection.release();}
  }
  return {pool,q,one,tx};
}
