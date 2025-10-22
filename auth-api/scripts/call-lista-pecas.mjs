import 'dotenv/config';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const ordem = process.argv[2];
if (!ordem) {
  console.error('Uso: node scripts/call-lista-pecas.mjs <ordem>');
  process.exit(1);
}

const token = jwt.sign(
  { sub: '1', username: 'test-user', roles: ['user'] },
  process.env.JWT_SECRET,
  { expiresIn: '5m' }
);

const url = new URL('http://localhost:3001/user/lista-pecas');
url.searchParams.set('ordem', ordem);

try {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Fichas retornadas:', data?.fichas?.length ?? 'n/d');
} catch (err) {
  console.error('Erro na chamada HTTP:', err);
  process.exit(1);
}
