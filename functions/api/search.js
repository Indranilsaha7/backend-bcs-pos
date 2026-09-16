// functions/api/search.js
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = url.searchParams.get('q');
  // Enforce a strict max limit to heavily optimize DB read costs and prevent abusive massive reads
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  let stmt;
  try {
    if (query && query.trim() !== '') {
      // Optimizaton: Only fetching required columns, strictly limiting rows
      stmt = context.env.DB.prepare('SELECT id, title, created_at FROM documents WHERE title LIKE ? ORDER BY created_at DESC LIMIT ?')
                   .bind(`%${query.trim()}%`, limit);
    } else {
      // Optimizaton: Only fetching required columns, strictly limiting rows
      stmt = context.env.DB.prepare('SELECT id, title, created_at FROM documents ORDER BY created_at DESC LIMIT ?')
                   .bind(limit);
    }

    const { results } = await stmt.all();
    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Database read failed: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
