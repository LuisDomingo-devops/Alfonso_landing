const ALLOWED_ORIGINS = new Set([
    "https://alfonso-landing.luis-devopslab.workers.dev"
]);

export function getCorsHeaders(request) {
    const origin = request.headers.get("Origin");

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return {};
    }

    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
}

export function handleCorsPreflight(request) {
    const origin = request.headers.get("Origin");

    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return null;
    }

    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
    });
}
