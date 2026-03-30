import { verifyToken, getUserById } from '../services/authService.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'נדרשת התחברות' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'טוקן לא תקין או פג תוקף' });
  }

  const user = getUserById(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'משתמש לא נמצא' });
  }

  req.user = user;
  next();
}
