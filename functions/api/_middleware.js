// functions/api/_middleware.js
const ALLOWED_ORIGIN = 'https://bcs.bcsdeveloper.com';

const corsHeaders = {
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS,DELETE',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  
  // Allow requests from the specific frontend domain.
  // Desktop C# clients typically don't send an Origin header, so if origin is null, we allow it.
  if (!origin || origin === ALLOWED_ORIGIN) {
    return {
      ...corsHeaders,
      'Access-Control-Allow-Origin': origin || '*',
    };
  }
  
  // Fallback (Browsers will reject this if origin doesn't match)
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  };
}

// Intercept OPTIONS requests for pre-flight CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(context.request),
  });
}

// Intercept all other requests to inject CORS, and handle the fake wait utility
export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // Fake waiting utility: simulate delay for testing frontend loading states
  // Triggered by adding ?wait=true to the URL
  if (url.searchParams.get('wait') === 'true') {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  try {
    // Proceed to the actual route handler (add.js, remove.js, search.js)
    const response = await context.next();
    
    // Clone the response to make its headers mutable
    const newResponse = new Response(response.body, response);
    
    // Inject CORS headers
    const headers = getCorsHeaders(context.request);
    for (const [key, value] of Object.entries(headers)) {
      newResponse.headers.set(key, value);
    }
    
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Internal Server Error: ' + error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(context.request), 'Content-Type': 'application/json' }
    });
  }
}
