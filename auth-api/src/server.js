// Login com Google: recebe id_token, valida, cria/atualiza usuário e retorna JWT
import fetch from 'node-fetch';


import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pg from "pg";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : undefined,
});

// Garantir tabela para armazenar códigos de reset
(async function ensureResetTable(){
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.auth_password_reset (
        id serial PRIMARY KEY,
        user_id bigint NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
        code varchar(6) NOT NULL,
        created_at timestamptz DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used boolean DEFAULT false
      );
    `);
    console.log('auth_password_reset table ensured');
  }catch(e){ console.error('Erro criando auth_password_reset table:', e); }
})();

const JWT_TTL = "8h";
function signJwt(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_TTL });
}
function requireAuth(req, res, next) {
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  try { req.user = jwt.verify(auth, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "unauthorized" }); }
}
app.get("/healthz", async (_req, res) => {
  try { await pool.query("select 1"); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ ok:false, error: String(e) }); }
});

app.post('/auth/google-login', async (req, res) => {
  try {
    const schema = z.object({ id_token: z.string().min(10) });
    const { id_token } = schema.parse(req.body);
    // Validar token com Google
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
    if (!googleRes.ok) return res.status(401).json({ error: 'Token Google inválido.' });
    const googleData = await googleRes.json();
    const email = googleData.email;
    const name = googleData.name || '';
    if (!email) return res.status(400).json({ error: 'E-mail não encontrado no token Google.' });
    // Procurar usuário pelo e-mail
    let user;
    const { rows } = await pool.query(`SELECT id, username, roles FROM public.auth_user WHERE email = $1 LIMIT 1`, [email]);
    if (rows[0]) {
      user = rows[0];
    } else {
      // Criar novo usuário (username = email, senha aleatória)
      const username = email;
      const password = Math.random().toString(36).slice(-10);
      const insert = await pool.query(
        `INSERT INTO public.auth_user (username, email, password_hash, roles, is_active, created_at, updated_at) VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, true, now(), now()) RETURNING id, username, roles`,
        [username, email, password, JSON.stringify(['user'])]
      );
      user = insert.rows[0];
    }
    // Gerar JWT
    const token = signJwt({ sub: String(user.id), username: user.username, roles: user.roles || [] });
    return res.json({ token, user: { id: user.id, username: user.username, roles: user.roles || [] } });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.' });
    console.error('Erro /auth/google-login:', e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post("/auth/login", async (req, res) => {
  const LoginSchema = z.object({ username: z.string().min(3), password: z.string().min(6) });
  try {
    const { username, password } = LoginSchema.parse(req.body);
    let userRecord = null;

    try {
      const { rows } = await pool.query(
        `SELECT id, username, roles FROM public.auth_login($1::text, $2::text, NULL::inet, NULL::text)`, [username, password]);
      const u = rows[0];
      if (u) {
        const { rows: details } = await pool.query(
          `SELECT id, username, roles, is_active, email FROM public.auth_user WHERE id = $1 LIMIT 1`, [u.id]);
        userRecord = details[0] || null;
      }
    } catch (e) {
      if (!["42883","42501"].includes(e?.code)) console.warn("auth_login() falhou:", { code: e?.code, message: e?.message });
    }

    if (!userRecord) {
      const { rows } = await pool.query(
        `SELECT id, username, roles, is_active, email FROM public.auth_user
          WHERE username = $1 AND password_hash = crypt($2, password_hash) LIMIT 1`, [username, password]);
      userRecord = rows[0] || null;
    }

    if (!userRecord) return res.status(401).json({ error: "Usuário ou senha inválidos." });
    if (userRecord.is_active === false) return res.status(403).json({ error: "Usuário inativo." });

    if (!userRecord.email) {
      return res.json({ needsEmail: true, user: { username: userRecord.username } });
    }

    const token = signJwt({ sub: String(userRecord.id), username: userRecord.username, roles: userRecord.roles || [] });
    return res.json({ token, user: { id: userRecord.id, username: userRecord.username, roles: userRecord.roles || [], email: userRecord.email } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos." });
    console.error("Erro /auth/login:", err); return res.status(500).json({ error: "Erro interno." });
  }
});

app.post('/auth/complete-registration', async (req, res) => {
  const schema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    newPassword: z.string().min(6),
    email: z.string().email()
  });
  try {
    const { username, password, newPassword, email } = schema.parse(req.body || {});

    const { rows } = await pool.query(
      `SELECT id, email FROM public.auth_user WHERE username = $1 AND password_hash = crypt($2, password_hash) LIMIT 1`,
      [username, password]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
    if (user.email) return res.status(400).json({ error: 'E-mail já cadastrado.' });

    const { rows: emailExists } = await pool.query(`SELECT 1 FROM public.auth_user WHERE email = $1 LIMIT 1`, [email]);
    if (emailExists[0]) return res.status(400).json({ error: 'E-mail já em uso.' });

    await pool.query(
      `UPDATE public.auth_user SET email = $1, password_hash = crypt($2, gen_salt('bf')), updated_at = now() WHERE id = $3`,
      [email, newPassword, user.id]
    );

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.' });
    console.error('Erro /auth/complete-registration:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});
// Rota para solicitar reset de senha (esqueci a senha)
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const body = req.body || {};
    const identifier = (body.email || body.username || "").trim();
    if (!identifier) return res.status(400).json({ error: "Informe e-mail ou usuário." });

    // Tentar achar pelo e-mail primeiro, depois por username
    const { rows: byEmail } = await pool.query(`SELECT id, username, email FROM public.auth_user WHERE email = $1 LIMIT 1`, [identifier]);
    let user = byEmail[0];
    if (!user) {
      const { rows: byUser } = await pool.query(`SELECT id, username, email FROM public.auth_user WHERE username = $1 LIMIT 1`, [identifier]);
      user = byUser[0];
    }
    // Para não vazar informação, sempre retornar 200 com mensagem genérica
    if (!user) return res.json({ ok: true, message: "Se o email/usuário existir, você receberá instruções por e-mail." });

    // Gerar código numérico de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + (Number(process.env.RESET_CODE_TTL_MINUTES || 15) * 60 * 1000));
    try {
      await pool.query(`INSERT INTO public.auth_password_reset (user_id, code, expires_at) VALUES ($1,$2,$3)`, [user.id, code, expiresAt.toISOString()]);
    } catch(e){ console.error('Erro ao salvar reset code:', e); }

    const messageText = `Olá ${user.username},\n\nRecebemos uma solicitação para redefinir sua senha. Use o código de 6 dígitos abaixo no aplicativo:\n\n${code}\n\nEste código expira em ${process.env.RESET_CODE_TTL_MINUTES || 15} minutos. Se você não solicitou, ignore.`;

    // Tentar enviar e-mail se configurado
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        const from = process.env.FROM_EMAIL || process.env.SMTP_USER;
        const info = await transporter.sendMail({
          from,
          to: user.email || process.env.FROM_EMAIL,
          subject: 'Código para redefinição de senha',
          text: messageText,
        });
        console.log('Forgot-password email sent:', info && info.messageId);
      } else {
        console.log('RESET CODE (no SMTP configured):', code, 'for user', user.username, user.email);
      }
    } catch (e) {
      console.error('Erro ao enviar email de reset:', e);
    }

    return res.json({ ok: true, message: 'Se o email/usuário existir, você receberá instruções por e-mail com o código.' });
  } catch (e) {
    console.error('Erro /auth/forgot-password:', e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
});

// Verificar código de reset
app.post('/auth/verify-reset-code', async (req, res) => {
  try{
    const schema = z.object({ username: z.string().min(3), code: z.string().length(6) });
    const { username, code } = schema.parse(req.body);
    const { rows: users } = await pool.query(`SELECT id FROM public.auth_user WHERE username = $1 LIMIT 1`, [username]);
    const user = users[0]; if (!user) return res.status(400).json({ error: 'Usuário inválido.' });
    const { rows } = await pool.query(`SELECT id FROM public.auth_password_reset WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [user.id, code]);
    if (!rows[0]) return res.status(400).json({ error: 'Código inválido ou expirado.' });
    return res.json({ ok: true });
  }catch(e){ if (e instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.' }); console.error('Erro /auth/verify-reset-code:', e); return res.status(500).json({ error:'Erro interno.'}); }
});

// Resetar senha usando código
app.post('/auth/reset-password', async (req, res) => {
  try{
    const schema = z.object({ username: z.string().min(3), code: z.string().length(6), newPassword: z.string().min(6) });
    const { username, code, newPassword } = schema.parse(req.body);
    const client = await pool.connect();
    try{
      await client.query('BEGIN');
      const { rows: users } = await client.query(`SELECT id FROM public.auth_user WHERE username = $1 LIMIT 1`, [username]);
      const user = users[0]; if (!user) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Usuário inválido.' }); }
      const { rows } = await client.query(`SELECT id FROM public.auth_password_reset WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [user.id, code]);
      const row = rows[0]; if (!row) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Código inválido ou expirado.' }); }
      // Atualizar senha
      await client.query(`UPDATE public.auth_user SET password_hash = crypt($1, gen_salt('bf')) WHERE id = $2`, [newPassword, user.id]);
      // Marcar código como usado
      await client.query(`UPDATE public.auth_password_reset SET used = true WHERE id = $1`, [row.id]);
      await client.query('COMMIT');
      return res.json({ ok: true, message: 'Senha redefinida com sucesso.' });
    }catch(e){ await client.query('ROLLBACK'); console.error('Erro reset-password transaction:', e); return res.status(500).json({ error:'Erro interno.' }); }
    finally{ client.release(); }
  }catch(e){ if (e instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.' }); console.error('Erro /auth/reset-password:', e); return res.status(500).json({ error:'Erro interno.'}); }
});
app.get("/auth/me", requireAuth, async (req, res) => { res.json({ ok: true, user: req.user }); });
app.get("/user/profile", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const { rows } = await pool.query(`SELECT id, username, roles, is_active, created_at, updated_at FROM public.auth_user WHERE id = $1`, [userId]);
  const u = rows[0]; if (!u) return res.status(404).json({ error: "not found" }); res.json(u);
});
app.get("/user/operacoes", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const sql = `SELECT DISTINCT COALESCE(o.operacao, uo.operacao_id::text) AS operacao
                 FROM public.auth_user_operacao uo
            LEFT JOIN public.omie_operacao o ON o.operacao = uo.operacao_id::text
                WHERE uo.user_id = $1
             ORDER BY 1`;
  try { const { rows } = await pool.query(sql, [userId]); res.json(rows.map(r => r.operacao)); }
  catch(e){ console.error("Erro /user/operacoes:", e); res.status(500).json({ error:"Erro interno." }); }
});

app.get("/user/busca-codigo", requireAuth, async (req, res) => {
  const term = String(req.query.term || "").trim();
  if (!term) return res.status(400).json({ error: "Informe um termo de busca." });

  const like = `%${term}%`;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const sql = `
    WITH resultados AS (
      SELECT 'historico_op_glide'::text AS tabela,
             'pedido'::text AS coluna,
             pedido::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'controlador', MAX(NULLIF(BTRIM(controlador::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'primeiro_teste_tipo_de_gas', MAX(NULLIF(BTRIM(primeiro_teste_tipo_de_gas::text), ''))
             ) AS detalhes
        FROM public.historico_op_glide
       WHERE pedido IS NOT NULL AND pedido::text ILIKE $1
       GROUP BY pedido

      UNION ALL

      SELECT 'historico_op_glide'::text AS tabela,
             'ordem_de_producao'::text AS coluna,
             ordem_de_producao::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'controlador', MAX(NULLIF(BTRIM(controlador::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'primeiro_teste_tipo_de_gas', MAX(NULLIF(BTRIM(primeiro_teste_tipo_de_gas::text), ''))
             ) AS detalhes
        FROM public.historico_op_glide
       WHERE ordem_de_producao IS NOT NULL AND ordem_de_producao::text ILIKE $1
       GROUP BY ordem_de_producao

      UNION ALL

      SELECT 'historico_op_glide_f_escopo'::text AS tabela,
             'pedido'::text AS coluna,
             pedido::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'controlador', MAX(NULLIF(BTRIM(controlador::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'primeiro_teste_tipo_de_gas', MAX(NULLIF(BTRIM(primeiro_teste_tipo_de_gas::text), ''))
             ) AS detalhes
        FROM public.historico_op_glide_f_escopo
       WHERE pedido IS NOT NULL AND pedido::text ILIKE $1
       GROUP BY pedido

      UNION ALL

      SELECT 'historico_op_glide_f_escopo'::text AS tabela,
             'ordem_de_producao'::text AS coluna,
             ordem_de_producao::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'controlador', MAX(NULLIF(BTRIM(controlador::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'primeiro_teste_tipo_de_gas', MAX(NULLIF(BTRIM(primeiro_teste_tipo_de_gas::text), ''))
             ) AS detalhes
        FROM public.historico_op_glide_f_escopo
       WHERE ordem_de_producao IS NOT NULL AND ordem_de_producao::text ILIKE $1
       GROUP BY ordem_de_producao

      UNION ALL

      SELECT 'historico_pedido_originalis'::text AS tabela,
             'nota_fiscal'::text AS coluna,
             nota_fiscal::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'nota_fiscal', MAX(NULLIF(BTRIM(nota_fiscal::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'cliente', MAX(NULLIF(BTRIM(cliente::text), '')),
               'control', MAX(NULLIF(BTRIM(control::text), '')),
               'data_entrega', MAX(data_entrega)::text,
               'estado', MAX(NULLIF(BTRIM(estado::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'opcional', MAX(NULLIF(BTRIM(opcional::text), ''))
             ) AS detalhes
        FROM public.historico_pedido_originalis
       WHERE nota_fiscal IS NOT NULL AND nota_fiscal::text ILIKE $1
       GROUP BY nota_fiscal

      UNION ALL

      SELECT 'historico_pedido_originalis'::text AS tabela,
             'ordem_de_producao'::text AS coluna,
             ordem_de_producao::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'nota_fiscal', MAX(NULLIF(BTRIM(nota_fiscal::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'cliente', MAX(NULLIF(BTRIM(cliente::text), '')),
               'control', MAX(NULLIF(BTRIM(control::text), '')),
               'data_entrega', MAX(data_entrega)::text,
               'estado', MAX(NULLIF(BTRIM(estado::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'opcional', MAX(NULLIF(BTRIM(opcional::text), ''))
             ) AS detalhes
        FROM public.historico_pedido_originalis
       WHERE ordem_de_producao IS NOT NULL AND ordem_de_producao::text ILIKE $1
       GROUP BY ordem_de_producao

      UNION ALL

      SELECT 'historico_pedido_originalis'::text AS tabela,
             'pedido'::text AS coluna,
             pedido::text AS valor,
             MAX(NULLIF(BTRIM(modelo::text), '')) AS modelo_ref,
             json_build_object(
               'nota_fiscal', MAX(NULLIF(BTRIM(nota_fiscal::text), '')),
               'ordem_de_producao', MAX(NULLIF(BTRIM(ordem_de_producao::text), '')),
               'pedido', MAX(NULLIF(BTRIM(pedido::text), '')),
               'cliente', MAX(NULLIF(BTRIM(cliente::text), '')),
               'control', MAX(NULLIF(BTRIM(control::text), '')),
               'data_entrega', MAX(data_entrega)::text,
               'estado', MAX(NULLIF(BTRIM(estado::text), '')),
               'modelo', MAX(NULLIF(BTRIM(modelo::text), '')),
               'opcional', MAX(NULLIF(BTRIM(opcional::text), ''))
             ) AS detalhes
        FROM public.historico_pedido_originalis
       WHERE pedido IS NOT NULL AND pedido::text ILIKE $1
       GROUP BY pedido
  )
  SELECT r.tabela,
           r.coluna,
           r.valor,
           r.detalhes,
           img.url_imagem AS imagem_url
      FROM resultados r
      LEFT JOIN LATERAL (
        SELECT poi.url_imagem
          FROM public.produtos_omie po
          JOIN public.produtos_omie_imagens poi ON poi.codigo_produto = po.codigo_produto
         WHERE po.codigo = r.modelo_ref
         ORDER BY poi.url_imagem
         LIMIT 1
      ) img ON TRUE
    ORDER BY r.tabela, r.coluna, r.valor
    LIMIT $2;
  `;

  try {
    const { rows } = await pool.query(sql, [like, limit]);
    console.log("[/user/busca-codigo] termo", term, "rows", rows.slice(0, 5));
    res.json({ term, results: rows });
  } catch (e) {
    console.error("Erro /user/busca-codigo:", e);
    res.status(500).json({ error: "Erro interno." });
  }
});
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Auth API on port ${PORT}`));
