export async function onRequestPost(context) {
  try {
    const apiKey = context.request.headers.get('x-api-key');
    if (apiKey !== context.env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await context.request.json();
    const { username, password, security_code, device_token } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Missing username or password' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let query = 'SELECT * FROM users WHERE username = ? AND password_hash = ?';
    const params = [username, password];

    if (security_code) {
      query += ' AND security_code = ?';
      params.push(security_code);
    }
    
    if (device_token) {
      query += ' AND device_token = ?';
      params.push(device_token);
    }

    const { results } = await context.env.DB.prepare(query)
      .bind(...params)
      .all();

    if (results && results.length > 0) {
      const user = results[0];
      let permissions = [];
      if (user.permissions) {
        try {
          permissions = JSON.parse(user.permissions);
          if (!Array.isArray(permissions)) permissions = [];
        } catch (e) {
          permissions = [];
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Login successful',
        device_token: user.device_token,
        role: user.role,
        permissions: permissions
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
