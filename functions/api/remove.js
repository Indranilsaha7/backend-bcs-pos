// functions/api/remove.js
export async function onRequestDelete(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ success: false, error: 'Document ID is required via query param (?id=...)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Cost Optimization: Prepared statement
  const stmt = context.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id);
  
  try {
    const { meta } = await stmt.run();
    
    // Check meta.changes to ensure the delete operation actually hit a row
    if (meta.changes > 0) {
      return new Response(JSON.stringify({ success: true, message: 'Document removed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Document not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Database deletion failed: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
