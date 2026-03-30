import { Router } from 'express';
import multer from 'multer';
import { analyzeFood, isAIReady } from '../services/aiService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Analyze food input (requires auth)
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { text } = req.body;
    let imageBase64 = null;
    let audioBase64 = null;
    
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      if (req.file.mimetype.startsWith('image/')) {
        imageBase64 = base64;
      } else if (req.file.mimetype.startsWith('audio/')) {
        audioBase64 = base64;
      }
    }
    
    if (!text && !imageBase64 && !audioBase64) {
      return res.status(400).json({ error: 'לא סופק קלט' });
    }
    
    const result = await analyzeFood(text, imageBase64, audioBase64);
    res.json(result);
  } catch (e) {
    console.error('Analyze error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Check if AI is configured (public)
router.get('/status', (req, res) => {
  res.json({ ready: isAIReady() });
});

export default router;
