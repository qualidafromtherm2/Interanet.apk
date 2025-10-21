
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
app.post("/auth/login", async (req, res) => {
  const LoginSchema = z.object({ username: z.string().min(3), password: z.string().min(6) });
  try {
    const { username, password } = LoginSchema.parse(req.body);
    try {
      const { rows } = await pool.query(
        `SELECT id, username, roles FROM public.auth_login($1::text, $2::text, NULL::inet, NULL::text)`, [username, password]);
      const u = rows[0];
      if (u) {
        const token = signJwt({ sub: String(u.id), username: u.username, roles: u.roles || [] });
        return res.json({ token, user: { id: u.id, username: u.username, roles: u.roles || [] } });
      }
    } catch (e) {
      if (!["42883","42501"].includes(e?.code)) console.warn("auth_login() falhou:", { code: e?.code, message: e?.message });
    }
    const { rows: r2 } = await pool.query(
      `SELECT id, username, roles, is_active FROM public.auth_user
        WHERE username = $1 AND password_hash = crypt($2, password_hash) LIMIT 1`, [username, password]);
    const user = r2[0];
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos." });
    if (user.is_active === false) return res.status(403).json({ error: "Usuário inativo." });
    const token = signJwt({ sub: String(user.id), username: user.username, roles: user.roles || [] });
    return res.json({ token, user: { id: user.id, username: user.username, roles: user.roles || [] } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos." });
    console.error("Erro /auth/login:", err); return res.status(500).json({ error: "Erro interno." });
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
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Auth API on port ${PORT}`));
