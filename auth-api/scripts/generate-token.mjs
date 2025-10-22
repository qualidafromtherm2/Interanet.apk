import jwt from 'jsonwebtoken';
import 'dotenv/config';

const payload = {
  sub: '1',
  username: 'test-user',
  roles: ['user'],
};

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
