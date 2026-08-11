const API_PREFIX = "/api";

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Cache-Control": "no-store"
        }
    });
}

async function handleApiRequest(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && url.pathname === "/api/health") {
        return jsonResponse(
            {
                error: "Method not allowed"
            },
            405
        );
    }

    if (url.pathname === "/api/health") {
        return jsonResponse({
            status: "ok",
            service: "alfonso-landing",
            version: "1.0.0"
        });
    }

    return jsonResponse(
        {
            error: "API endpoint not found"
        },
        404
    );
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith(`${API_PREFIX}/`)) {
            return handleApiRequest(request);
        }

        return env.ASSETS.fetch(request);
    }
};