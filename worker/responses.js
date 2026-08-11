export function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

export function successResponse(data = null, status = 200, headers = {}) {
    return jsonResponse(
        {
            success: true,
            data
        },
        status,
        headers
    );
}

export function errorResponse(
    code,
    message,
    status = 400,
    headers = {}
) {
    return jsonResponse(
        {
            success: false,
            error: {
                code,
                message
            }
        },
        status,
        headers
    );
}
