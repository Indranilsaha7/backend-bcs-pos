const ALLOWED_ORIGIN = '*'; // Migration script can run from anywhere

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Security check: Only allow access with the master API Key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== env.API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized API Key' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const table = body.table;
    const data = body.data;

    if (!table || !data) {
      return new Response(JSON.stringify({ success: false, error: 'Missing table or data payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const keys = Object.keys(data);
    
    // Auto-Create Table if not exists based on the payload (Treat everything as TEXT in SQLite)
    if (body.action === 'create_table' || body.action === 'insert_record') {
        const columnDefs = keys.map(k => {
           if (k === 'id') return `"${k}" TEXT PRIMARY KEY`;
           return `"${k}" TEXT`;
        });
        
        const createQuery = `CREATE TABLE IF NOT EXISTS "${table}" (${columnDefs.join(', ')});`;
        await env.DB.prepare(createQuery).run();

        // Schema Evolution: Add missing columns
        try {
            const { results } = await env.DB.prepare(`PRAGMA table_info("${table}")`).all();
            const existingColumns = results.map(r => r.name);
            
            for (const key of keys) {
                if (!existingColumns.includes(key)) {
                    await env.DB.prepare(`ALTER TABLE "${table}" ADD COLUMN "${key}" TEXT`).run();
                }
            }
        } catch(e) {
            console.error("Schema evolution error:", e);
        }
    }

    // Dynamic insert generation
    // Stringify objects/arrays because D1 doesn't accept them natively in prepared statements
    const values = Object.values(data).map(val => {
        if (val !== null && typeof val === 'object') {
            return JSON.stringify(val);
        }
        return val;
    });
    
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');

    // Use INSERT OR REPLACE to handle re-runs gracefully
    const query = `INSERT OR REPLACE INTO "${table}" (${columns}) VALUES (${placeholders})`;

    // Use binding for SQL injection protection
    const stmt = env.DB.prepare(query).bind(...values);
    
    await stmt.run();

    return new Response(JSON.stringify({ success: true, message: `Inserted into ${table}` }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Migration API Error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
