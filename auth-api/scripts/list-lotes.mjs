import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : undefined,
});

try {
  const { rows } = await pool.query(`
    SELECT DISTINCT lote_antecipado::text AS lote
      FROM public.historico_op_iapp
     WHERE lote_antecipado IS NOT NULL
     ORDER BY 1 DESC
     LIMIT 10
  `);
  console.log(rows.map(({ lote }) => lote));
} catch (err) {
  console.error('Erro buscando lotes:', err);
} finally {
  await pool.end();
}
