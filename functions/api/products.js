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

    // 3. CRUD Logic
    if (method === 'GET') {
      const stmt = env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT 100');
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ success: true, data: results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'POST') {
      const body = await request.json();
      const stmt = env.DB.prepare(
        'INSERT INTO products (name, price, created_at) VALUES (?, ?, ?) RETURNING id'
      ).bind(body.name || '', body.price || 0, new Date().toISOString());
      
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ success: true, id: results[0].id }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'PUT') {
      const body = await request.json();
      const stmt = env.DB.prepare(
        'UPDATE products SET name = ?, price = ? WHERE id = ?'
      ).bind(body.name, body.price, body.id);
      
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
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
