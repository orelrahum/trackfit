import { Router } from 'express';
import { searchProducts, getAllCategories, getAllProducts, addCustomProduct } from '../services/productService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Search products (public)
router.get('/search', async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.json([]);
  const results = await searchProducts(q, parseInt(limit) || 20);
  res.json(results);
});

// Get all categories (public)
router.get('/categories', async (req, res) => {
  res.json(await getAllCategories());
});

// Catalog: paginated, sorted א-ת, with optional search
router.get('/catalog', (req, res) => {
  const { page = 0, limit = 50, q, source, type } = req.query;
  const pageNum = parseInt(page);
  const pageSize = parseInt(limit);
  
  let products = getAllProducts();

  if (source) {
    const sources = source.split(',');
    products = products.filter(p => sources.includes(p.source));
  }
  
  if (type) {
    const types = type.split(',');
    products = products.filter(p => types.includes(p.type));
  }
  
  if (q) {
    const query = q.toLowerCase();
    products = products.filter(p => {
      const searchable = `${p.name} ${p.brand || ''}`.toLowerCase();
      return searchable.includes(query);
    });
  }
  
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  
  const start = pageNum * pageSize;
  const paged = sorted.slice(start, start + pageSize);
  
  res.json({
    products: paged,
    total: sorted.length,
    page: pageNum,
    pageSize
  });
});

// Add custom product (requires auth)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const product = await addCustomProduct(req.user.id, req.body);
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
