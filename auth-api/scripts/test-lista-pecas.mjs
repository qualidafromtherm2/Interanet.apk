import 'dotenv/config';
import pg from 'pg';

const ordem = process.argv[2];
if (!ordem) {
  console.error('Uso: node scripts/test-lista-pecas.mjs <ordem>');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : undefined,
});

const sql = `
  WITH fichas AS (
    SELECT DISTINCT NULLIF(BTRIM(ficha_tecnica_identificacao::text), '') AS ficha_tecnica_identificacao
      FROM public.historico_op_iapp
     WHERE lote_antecipado IS NOT NULL
       AND lote_antecipado::text = $1
       AND ficha_tecnica_identificacao IS NOT NULL
  )
  SELECT
    hei.identificacao_da_ficha_tecnica,
    NULLIF(BTRIM(hei.descricao_da_operacao::text), '') AS descricao_da_operacao,
    NULLIF(BTRIM(hei.identificacao_do_produto::text), '') AS identificacao_do_produto,
    NULLIF(BTRIM(hei.descricao_do_produto::text), '') AS descricao_do_produto,
    NULLIF(BTRIM(hei.identificacao_do_produto_consumido::text), '') AS identificacao_do_produto_consumido,
    NULLIF(BTRIM(hei.descricao_do_produto_consumido::text), '') AS descricao_do_produto_consumido,
    hei.quantidade_prevista_de_consumo
  FROM public.historico_estrutura_iapp hei
  JOIN fichas f ON f.ficha_tecnica_identificacao = NULLIF(BTRIM(hei.identificacao_da_ficha_tecnica::text), '')
   WHERE hei.identificacao_do_produto_consumido IS NOT NULL
     AND COALESCE(hei.identificacao_do_produto_consumido::text, '') <> ''
     AND NOT (
       upper(COALESCE(hei.identificacao_do_produto_consumido::text, '')) LIKE ANY (
         ARRAY['06.MP%', '02.MP%', '07.MP%', '08.EM%', '01.MP%']
       )
     )
   ORDER BY
     hei.identificacao_da_ficha_tecnica,
     NULLIF(BTRIM(hei.descricao_da_operacao::text), ''),
     NULLIF(BTRIM(hei.identificacao_do_produto_consumido::text), '');
`;

try {
  const { rows } = await pool.query(sql, [ordem]);
  console.log(`Consulta executada. Ordem: ${ordem}. Registros retornados: ${rows.length}.`);
} catch (err) {
  console.error('Erro ao executar consulta:', err);
} finally {
  await pool.end();
}
