export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname.startsWith("/api/")) {
            return new Response(
                JSON.stringify({
                    error: "API endpoint not implemented"
                }),
                {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8"
                    }
                }
            );
        }

        return env.ASSETS.fetch(request);
    }
};