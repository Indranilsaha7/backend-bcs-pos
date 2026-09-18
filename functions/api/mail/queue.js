export async function onRequest(context) {
  const { request, env } = context;

  const ALLOWED_ORIGINS = [
    'https://bcs.bcsdeveloper.com',
    'https://shop.bcsdeveloper.com',
    'https://delivery.bcsdeveloper.com',
    'http://localhost:3000',
    'http://localhost:8787'
  ];
  
  const origin = request.headers.get('Origin');
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== env.API_KEY) {
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid App Code' }), { status: 403, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await request.json();
    const { to, subject, htmlBody } = payload;

    if (!to || !subject || !htmlBody) {
      return new Response(JSON.stringify({ error: 'Missing email parameters' }), { status: 400, headers: corsHeaders });
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      // This will print Google's exact error in Postman
      return new Response(JSON.stringify({ 
        error: 'Google Token Error', 
        details: tokenData 
      }), { status: 400, headers: corsHeaders });
    }

    const emailContent = [
      `To: ${to}`,
      `From: "BCSdevloper™ Support" <${env.GMAIL_USER}>`,
      `Reply-To: support@bcs.bcsdeveloper.com`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      htmlBody
    ].join('\r\n');

    const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedEmail }),
    });

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      throw new Error(`Gmail API Error: ${sendData.error?.message || 'Unknown error'}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email dispatched successfully',
      id: sendData.id 
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
