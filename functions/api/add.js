// functions/api/add.js
export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!body || typeof body.title !== 'string' || body.title.trim() === '') {
    return new Response(JSON.stringify({ success: false, error: 'Title is required and must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Cost Optimization: Prepared statement with D1 for caching and single-trip ID return
  const stmt = context.env.DB.prepare(
    'INSERT INTO documents (title, content, created_at) VALUES (?, ?, ?) RETURNING id'
  ).bind(body.title.trim(), body.content || '', new Date().toISOString());
  
  try {
    const { results } = await stmt.all();
    return new Response(JSON.stringify({ success: true, message: 'Document added', id: results[0].id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Database insertion failed: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
