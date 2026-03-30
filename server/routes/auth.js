import { Router } from 'express';
import { registerUser, loginUser, isProfileCompleted } from '../services/authService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Register
router.post('/register', (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'נא למלא את כל השדות' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'סיסמה חייבת להיות לפחות 6 תווים' });
    }

    const user = registerUser(email, password, name);
    const { token } = loginUser(email, password);
    res.json({ token, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'נא למלא אימייל וסיסמה' });
    }

    const result = loginUser(email, password);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: { ...req.user, profile_completed: isProfileCompleted(req.user.id) } });
});

export default router;
