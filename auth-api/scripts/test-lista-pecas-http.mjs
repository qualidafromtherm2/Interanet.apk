import { spawn } from 'child_process';
import { once } from 'events';
import { setTimeout as delay } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const ordem = process.argv[2];
if (!ordem) {
  console.error('Uso: node scripts/test-lista-pecas-http.mjs <ordem>');
  process.exit(1);
}

const token = jwt.sign(
  { sub: '1', username: 'test-user', roles: ['user'] },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = spawn('node', ['src/server.js'], {
  cwd: dirname(__dirname),
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env },
});

const waitForReady = async () => {
  await delay(1000);
};

const waitForExit = async () => {
  try {
    await once(server, 'exit');
  } catch {
    // ignore
  }
};

try {
  await Promise.race([
    waitForReady(),
    delay(5000).then(() => { throw new Error('Timeout aguardando servidor'); }),
  ]);

  const response = await fetch(`http://localhost:${process.env.PORT || 3001}/user/lista-pecas?ordem=${ordem}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Status HTTP:', response.status);
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    console.log('Total de fichas:', body?.fichas?.length ?? 0);
    console.log('Primeira ficha exemplo:', body?.fichas?.[0] ?? null);
  } catch (parseErr) {
    console.error('Resposta não pôde ser parseada como JSON. Corpo bruto:', text.slice(0, 200));
    throw parseErr;
  }
} catch (err) {
  console.error('Erro durante teste HTTP:', err);
} finally {
  server.kill('SIGINT');
  await Promise.race([
    waitForExit(),
    delay(2000),
  ]);
}
