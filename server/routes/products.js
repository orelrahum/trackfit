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
router.get('/catalog', async (req, res) => {
  const { page = 0, limit = 50, q, source, type } = req.query;
  const pageNum = parseInt(page);
  const pageSize = parseInt(limit);
  
  let items = [];
  const types = type ? type.split(',') : null;
  const sources = source ? source.split(',') : null;

  if (!types || types.includes('food')) {
    let foods = (await getAllProducts()).filter(p => p.type === 'food');
    if (sources) foods = foods.filter(p => sources.includes(p.source));
    items = items.concat(foods);
  }
  if (!types || types.includes('recipe')) {
    let recipes = (await getAllProducts()).filter(p => p.type === 'recipe');
    if (sources) recipes = recipes.filter(p => sources.includes(p.source));
    items = items.concat(recipes);
  }
  
  if (q) {
    const query = q.toLowerCase();
    items = items.filter(p => {
      const searchable = `${p.name} ${p.brand || ''}`.toLowerCase();
      return searchable.includes(query);
    });

    // Relevance sort: exact name → starts with → contains
    items.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aExact = aName === query;
      const bExact = bName === query;
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aName.localeCompare(bName, 'he');
    });
  }
  
  const sorted = q ? items : [...items].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  
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
