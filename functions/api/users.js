const ALLOWED_ORIGIN = 'https://bcs.bcsdeveloper.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-user-id, x-security-code',
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

    // 2.5 User Identity & RBAC Security Layer (for mutations)
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      const userId = request.headers.get('x-user-id');
      const securityCode = request.headers.get('x-security-code');
      
      if (!userId || !securityCode) {
        return new Response(JSON.stringify({ success: false, error: 'Missing identity headers (x-user-id, x-security-code)' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const authStmt = env.DB.prepare('SELECT role, permissions FROM users WHERE id = ? AND security_code = ?').bind(userId, securityCode);
      const authUser = await authStmt.first();
      
      if (!authUser) {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden: Invalid user or security code' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (authUser.role !== 'admin') {
        let perms = [];
        try { perms = JSON.parse(authUser.permissions || '[]'); } catch(e) {}
        
        const requiredPerm = 'manage_users';
        if (!perms.includes(requiredPerm)) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden: Missing permission ' + requiredPerm }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 3. CRUD Logic
    if (method === 'GET') {
      const limit = Number(url.searchParams.get('limit')) || 100;
      const offset = Number(url.searchParams.get('offset')) || 0;
      
      const stmt = env.DB.prepare('SELECT id, username, role, permissions FROM users ORDER BY id DESC LIMIT ? OFFSET ?').bind(limit, offset);
      const { results } = await stmt.all();
      
      // Parse permissions for output
      const mappedResults = results.map(row => {
          try {
              row.permissions = row.permissions ? JSON.parse(row.permissions) : [];
          } catch(e) {
              row.permissions = [];
          }
          return row;
      });

      return new Response(JSON.stringify({ success: true, data: mappedResults }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (method === 'POST') {
      const body = await request.json();
      
      if (!body.username || !body.password_hash) {
          return new Response(JSON.stringify({ success: false, error: 'Missing username or password_hash' }), { 
             status: 400, 
             headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
      }
      
      const stmt = env.DB.prepare(
        `INSERT INTO users (
          username, password_hash, security_code, device_token, role, permissions
        ) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
      ).bind(
        body.username,
        body.password_hash,
        body.security_code || null,
        body.device_token || null,
        body.role || 'employee',
        body.permissions ? JSON.stringify(body.permissions) : null
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
         return new Response(JSON.stringify({ success: false, error: 'Missing user ID' }), { 
           status: 400, 
           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
      }

      const stmt = env.DB.prepare(
        `UPDATE users SET 
          username = COALESCE(?, username),
          password_hash = COALESCE(?, password_hash),
          security_code = COALESCE(?, security_code),
          device_token = COALESCE(?, device_token),
          role = COALESCE(?, role),
          permissions = COALESCE(?, permissions)
        WHERE id = ?`
      ).bind(
        body.username ?? null,
        body.password_hash ?? null,
        body.security_code ?? null,
        body.device_token ?? null,
        body.role ?? null,
        body.permissions ? JSON.stringify(body.permissions) : null,
        body.id
      );
      
      const { meta } = await stmt.run();
      if (meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
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
      
      const stmt = env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id);
      const { meta } = await stmt.run();
      if (meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
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
