import {
    successResponse,
    errorResponse
} from "./responses.js";

export async function handleApiRequest(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
        if (request.method !== "GET") {
            return errorResponse(
                "METHOD_NOT_ALLOWED",
                "Method not allowed.",
                405,
                {
                    Allow: "GET"
                }
            );
        }

        return successResponse({
            status: "ok",
            service: "alfonso-landing",
            version: "1.0.0"
        });
    }

    return errorResponse(
        "NOT_FOUND",
        "API endpoint not found.",
        404
    );
}
