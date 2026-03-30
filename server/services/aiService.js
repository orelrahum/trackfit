import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../db/database.js';
import { getAllProducts, getProductById } from './productService.js';

let genAI = null;
let model = null;

export function initializeAI(apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  console.log('Gemini AI initialized');
}

export function isAIReady() {
  return model !== null;
}

function getApiKey() {
  // Check runtime setting first, then env
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
  return row?.value || process.env.GEMINI_API_KEY;
}

export function ensureAI() {
  if (!model) {
    const key = getApiKey();
    if (key && key !== 'your_gemini_api_key_here') {
      initializeAI(key);
    } else {
      throw new Error('Gemini API key not configured. Go to Settings to add it.');
    }
  }
}

// Build product catalog context - we chunk it to fit in context window
function buildProductContext() {
  const products = getAllProducts();
  // Send compact product list
  const lines = products.map(p => {
    const servings = (p.serving_sizes || [])
      .map(s => `${s.name}=${s.amount_g}g`)
      .join(', ');
    return `[${p.id}] ${p.name}${p.brand ? ` (${p.brand})` : ''}${servings ? ` | מנות: ${servings}` : ''}`;
  });
  return lines.join('\n');
}

const SYSTEM_PROMPT = `אתה עוזר תזונה חכם עבור אפליקציית Trackfit.
המשתמש יתאר מה הוא אכל (בטקסט, תמונה, או הקלטה קולית).

המשימה שלך: לזהות את המוצרים שהמשתמש אכל ולהתאים אותם **אך ורק** למוצרים מרשימת המוצרים שלנו.

חוקים חשובים:
1. החזר רק מוצרים שקיימים ברשימה שלנו. אם אין התאמה מדויקת, בחר את המוצר הכי קרוב מהרשימה.
2. אם לא ניתן למצוא שום התאמה ברשימה, השתמש בשם "מוצר כללי" עם product_id: null.
3. הערך את הכמות בגרמים על סמך התיאור של המשתמש.
4. אם המשתמש מציין מנה (כפית, כף, כוס, יחידה, פרוסה וכו'), המר אותה לגרמים.
5. השתמש במידע של serving_sizes מהרשימה כשהוא זמין.

החזר תשובה בפורמט JSON בלבד (ללא markdown, ללא backticks):
{
  "items": [
    {
      "product_id": 123,
      "product_name": "שם המוצר מהרשימה",
      "brand": "שם המותג",
      "amount_g": 30,
      "serving_description": "2 כפות",
      "confidence": 0.9
    }
  ],
  "notes": "הערות נוספות אם יש"
}`;

export async function analyzeFood(text = null, imageBase64 = null, audioBase64 = null) {
  ensureAI();
  
  const productCatalog = buildProductContext();
  
  const parts = [];
  
  // System context + product catalog
  parts.push({
    text: `${SYSTEM_PROMPT}\n\nרשימת המוצרים שלנו:\n${productCatalog}\n\n---\nהמשתמש מתאר:`
  });
  
  // User input
  if (text) {
    parts.push({ text: text });
  }
  
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64
      }
    });
    if (!text) {
      parts.push({ text: 'מה אני אוכל בתמונה? זהה את המוצרים והכמויות.' });
    }
  }
  
  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: 'audio/webm',
        data: audioBase64
      }
    });
    if (!text) {
      parts.push({ text: 'תזהה מה אמרתי שאכלתי בהקלטה ומצא את המוצרים המתאימים.' });
    }
  }
  
  const result = await model.generateContent(parts);
  const response = result.response;
  const responseText = response.text();
  
  // Parse JSON from response
  let parsed;
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (e) {
    console.error('Failed to parse AI response:', responseText);
    throw new Error('Failed to parse AI response. Please try again.');
  }
  
  // Enrich items with full nutritional data from our database
  const enrichedItems = (parsed.items || []).map(item => {
    const product = item.product_id ? getProductById(item.product_id) : null;
    const amountG = item.amount_g || 0;
    
    if (product) {
      const nutrients = product.nutrients_per_100g;
      const factor = amountG / 100;
      return {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand || '',
        amount_g: amountG,
        serving_description: item.serving_description || '',
        calories: Math.round(nutrients.calories * factor * 10) / 10,
        protein_g: Math.round(nutrients.protein_g * factor * 10) / 10,
        carbs_g: Math.round(nutrients.carbs_g * factor * 10) / 10,
        fat_g: Math.round(nutrients.fat_g * factor * 10) / 10,
        photo_url: product.photo_url,
        confidence: item.confidence || 0.5
      };
    }
    
    return {
      product_id: null,
      product_name: item.product_name || 'מוצר לא מזוהה',
      brand: item.brand || '',
      amount_g: amountG,
      serving_description: item.serving_description || '',
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      photo_url: null,
      confidence: item.confidence || 0.3
    };
  });
  
  return {
    items: enrichedItems,
    notes: parsed.notes || ''
  };
}
