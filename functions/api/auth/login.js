export async function onRequestPost(context) {
  try {
    const apiKey = context.request.headers.get('x-api-key');
    if (apiKey !== context.env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await context.request.json();
    const { username, password, code, action } = body;

    if (!username) {
      return new Response(JSON.stringify({ error: 'Missing username' }), { status: 400 });
    }

    // Step 1: Client asks for the Argon2 parameters/salts
    if (action === 'get_salt') {
      const { results } = await context.env.DB.prepare('SELECT password, code FROM users WHERE username = ? COLLATE NOCASE').bind(username).all();
      if (results && results.length > 0) {
        return new Response(JSON.stringify({
          success: true,
          password_hash: results[0].password,
          code_hash: results[0].code
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Step 2: Client sends the computed hashes
    if (action === 'login') {
      const { results } = await context.env.DB.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').bind(username).all();
      if (results && results.length > 0) {
        const user = results[0];
        
        // Strict equality check against the full Argon2 string
        if (user.password !== password) {
            return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
        }
        
        if (code && user.code && user.code !== code) {
            return new Response(JSON.stringify({ error: 'Invalid security code' }), { status: 401 });
        }

        let permissions = [];
        try { permissions = JSON.parse(user.permissions || '[]'); } catch (e) {}

        return new Response(JSON.stringify({
          success: true,
          message: 'Login successful',
          role: user.role,
          permissions: permissions
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
