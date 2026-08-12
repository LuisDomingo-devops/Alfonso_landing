import {
    successResponse,
    errorResponse
} from "./responses.js";

import {
    validateLead
} from "./validation.js";

import {
    handleAdminLogin,
    handleAdminLogout,
    handleAdminMe
} from "./admin.js";

import {
    handleAdminLeadsList,
    handleAdminLeadDetail
} from "./adminLeads.js";

const MAX_BODY_SIZE =
    10 * 1024;

const RATE_LIMIT_WINDOW_SECONDS =
    60;

const RATE_LIMIT_MAX_REQUESTS =
    5;

async function handleHealth(
    request
) {
    if (
        request.method !== "GET"
    ) {
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
        version: "1.2.0"
    });
}

function getClientIp(
    request
) {
    return (
        request.headers.get(
            "CF-Connecting-IP"
        ) ||
        request.headers.get(
            "X-Forwarded-For"
        ) ||
        "unknown"
    );
}

async function hashValue(
    value
) {
    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(value);

    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            data
        );

    return Array.from(
        new Uint8Array(digest)
    )
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}

async function checkRateLimit(
    request,
    env
) {
    const ip =
        getClientIp(request);

    const ipHash =
        await hashValue(ip);

    const now =
        Math.floor(
            Date.now() / 1000
        );

    const windowStart =
        Math.floor(
            now /
                RATE_LIMIT_WINDOW_SECONDS
        ) *
        RATE_LIMIT_WINDOW_SECONDS;

    try {
        const result =
            await env.alfonso_leads
                .prepare(
                    `
                    INSERT INTO rate_limits (
                        ip_hash,
                        window_start,
                        request_count
                    )
                    VALUES (?, ?, 1)
                    ON CONFLICT(
                        ip_hash,
                        window_start
                    )
                    DO UPDATE SET
                        request_count =
                            request_count + 1
                    RETURNING request_count
                    `
                )
                .bind(
                    ipHash,
                    windowStart
                )
                .first();

        const requestCount =
            Number(
                result?.request_count ||
                    1
            );

        return {
            allowed:
                requestCount <=
                RATE_LIMIT_MAX_REQUESTS,

            retryAfter:
                RATE_LIMIT_WINDOW_SECONDS -
                (now -
                    windowStart)
        };
    } catch (error) {
        console.error(
            "Rate limit error:",
            error
        );

        return {
            allowed: true,
            retryAfter: 0
        };
    }
}

async function handleLead(
    request,
    env
) {
    if (
        request.method !== "POST"
    ) {
        return errorResponse(
            "METHOD_NOT_ALLOWED",
            "Method not allowed.",
            405,
            {
                Allow: "POST"
            }
        );
    }

    const contentType =
        request.headers.get(
            "Content-Type"
        );

    if (
        !contentType ||
        !contentType
            .toLowerCase()
            .startsWith(
                "application/json"
            )
    ) {
        return errorResponse(
            "UNSUPPORTED_MEDIA_TYPE",
            "Content-Type must be application/json.",
            415
        );
    }

    const contentLength =
        request.headers.get(
            "Content-Length"
        );

    if (
        contentLength &&
        Number(contentLength) >
            MAX_BODY_SIZE
    ) {
        return errorResponse(
            "PAYLOAD_TOO_LARGE",
            "Request body is too large.",
            413
        );
    }

    let payload;

    try {
        const rawBody =
            await request.text();

        if (
            rawBody.length >
            MAX_BODY_SIZE
        ) {
            return errorResponse(
                "PAYLOAD_TOO_LARGE",
                "Request body is too large.",
                413
            );
        }

        payload =
            JSON.parse(rawBody);
    } catch {
        return errorResponse(
            "INVALID_JSON",
            "Request body must contain valid JSON.",
            400
        );
    }

    const validation =
        validateLead(payload);

    if (!validation.valid) {
        return errorResponse(
            validation.reason ===
                "HONEYPOT"
                ? "INVALID_LEAD"
                : "VALIDATION_ERROR",
            "Invalid lead data.",
            400
        );
    }

    const lead =
        validation.data;

    const rateLimit =
        await checkRateLimit(
            request,
            env
        );

    if (!rateLimit.allowed) {
        return errorResponse(
            "RATE_LIMITED",
            "Too many requests. Please try again later.",
            429,
            {
                "Retry-After":
                    String(
                        rateLimit.retryAfter
                    )
            }
        );
    }

    try {
        await env.alfonso_leads
            .prepare(
                `
                INSERT INTO leads (
                    name,
                    email,
                    company,
                    message,
                    source
                )
                VALUES (?, ?, ?, ?, ?)
                `
            )
            .bind(
                lead.name,
                lead.email,
                lead.company,
                lead.message,
                "landing_beta"
            )
            .run();
    } catch (error) {
        const errorMessage =
            String(
                error?.message || ""
            ).toLowerCase();

        if (
            errorMessage.includes(
                "unique"
            ) ||
            errorMessage.includes(
                "constraint"
            )
        ) {
            return successResponse(
                {
                    message:
                        "This email is already registered."
                },
                200
            );
        }

        console.error(
            "Error storing lead:",
            error
        );

        return errorResponse(
            "DATABASE_ERROR",
            "Unable to store lead.",
            500
        );
    }

    return successResponse(
        {
            message:
                "Lead received successfully."
        },
        202
    );
}

export async function handleApiRequest(
    request,
    env
) {
    const url =
        new URL(request.url);

    if (
        url.pathname ===
        "/api/health"
    ) {
        return handleHealth(
            request
        );
    }

    if (
        url.pathname ===
        "/api/leads"
    ) {
        return handleLead(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/admin/login"
    ) {
        return handleAdminLogin(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/admin/logout"
    ) {
        return handleAdminLogout(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/admin/me"
    ) {
        return handleAdminMe(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/admin/leads"
    ) {
        return handleAdminLeadsList(
            request,
            env
        );
    }

    const leadIdMatch =
        url.pathname.match(
            /^\/api\/admin\/leads\/(\d+)$/
        );

    if (leadIdMatch) {
        return handleAdminLeadDetail(
            request,
            env,
            Number(
                leadIdMatch[1]
            )
        );
    }

    return errorResponse(
        "NOT_FOUND",
        "API endpoint not found.",
        404
    );
}