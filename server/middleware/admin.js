const ADMIN_EMAIL = 'orelr180@gmail.com';

export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'אין הרשאת מנהל' });
  }
  next();
}

export function isAdmin(email) {
  return email === ADMIN_EMAIL;
}
