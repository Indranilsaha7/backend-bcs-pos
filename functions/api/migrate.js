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

    // Dynamic insert generation
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    // To handle sqlite keywords properly, wrap column names in double quotes or backticks if necessary, 
    // but assuming standard alphanumeric names here.
    const columns = keys.join(', ');
    const placeholders = keys.map(() => '?').join(', ');

    const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

    // Using env.DB.prepare().bind() properly handles sqlite types.
    // However, D1 bind() requires an array of values if dynamically spreading.
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
