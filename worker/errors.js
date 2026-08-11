import { errorResponse } from "./responses.js";

export function handleApiError(error) {
    console.error("API error:", error);

    return errorResponse(
        "INTERNAL_ERROR",
        "An internal server error occurred.",
        500
    );
}
