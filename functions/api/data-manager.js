const ALLOWED_ORIGIN = 'https://bcs.bcsdeveloper.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // 1. CORS Preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. API Key Security
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);

    // Helper to safely parse numbers
    const safeNumber = (val) => {
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    // 3. CRUD Logic
    if (method === 'GET') {
      const limit = Number(url.searchParams.get('limit')) || 100;
      const offset = Number(url.searchParams.get('offset')) || 0;
      
      const stmt = env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit, offset);
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ success: true, data: results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'POST') {
      const body = await request.json();
      const stmt = env.DB.prepare(
        `INSERT INTO products (
          name, barcode, category, brand, quantity, 
          buy_price, sell_price, wholesale_price, shop_sell_price, shop_wholesale_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
      ).bind(
        body.name || '',
        body.barcode || null,
        body.category || null,
        body.brand || null,
        safeNumber(body.quantity) || 0,
        safeNumber(body.buy_price) || 0,
        safeNumber(body.sell_price) || 0,
        safeNumber(body.wholesale_price) || 0,
        safeNumber(body.shop_sell_price) || 0,
        safeNumber(body.shop_wholesale_price) || 0,
        new Date().toISOString()
      );
      
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ success: true, id: results[0].id }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'PUT') {
      const body = await request.json();
      
      if (!body.id) {
         return new Response(JSON.stringify({ success: false, error: 'Missing product ID' }), { 
           status: 400, 
           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }

      const stmt = env.DB.prepare(
        `UPDATE products SET 
          name = COALESCE(?, name),
          barcode = COALESCE(?, barcode),
          category = COALESCE(?, category),
          brand = COALESCE(?, brand),
          quantity = COALESCE(?, quantity),
          buy_price = COALESCE(?, buy_price),
          sell_price = COALESCE(?, sell_price),
          wholesale_price = COALESCE(?, wholesale_price),
          shop_sell_price = COALESCE(?, shop_sell_price),
          shop_wholesale_price = COALESCE(?, shop_wholesale_price)
        WHERE id = ?`
      ).bind(
        body.name ?? null,
        body.barcode ?? null,
        body.category ?? null,
        body.brand ?? null,
        body.quantity !== undefined ? safeNumber(body.quantity) : null,
        body.buy_price !== undefined ? safeNumber(body.buy_price) : null,
        body.sell_price !== undefined ? safeNumber(body.sell_price) : null,
        body.wholesale_price !== undefined ? safeNumber(body.wholesale_price) : null,
        body.shop_sell_price !== undefined ? safeNumber(body.shop_sell_price) : null,
        body.shop_wholesale_price !== undefined ? safeNumber(body.shop_wholesale_price) : null,
        body.id
      );
      
      const { meta } = await stmt.run();
      if (meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) {
         return new Response(JSON.stringify({ success: false, error: 'Missing id param' }), { 
           status: 400, 
           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }
      
      const stmt = env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id);
      const { meta } = await stmt.run();
      if (meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Product not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Method not allowed fallback
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('API Error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
