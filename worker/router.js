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

import {
    handleGuideChat,
    handleAdminGuideStats
} from "./geminiGuide.js";

import {
    sendBetaWelcomeEmail
} from "./emailService.js";

import {
    handleRrssLogin,
    handleRrssLogout,
    handleRrssMe,
    handleRrssGenerate,
    handleRrssListPublications,
    handleRrssCreatePublication,
    handleRrssUpdatePublication,
    handleRrssDeletePublication,
    handleRrssGenerateBatch,
    handleRrssCreatePublicationsBatch,
    handleRrssGetTrends,
    handleRrssGetCompetitors,
    handleRrssCreateCompetitor,
    handleRrssDeleteCompetitor,
    handleRrssUpdateCompetitor,
    handleRrssListSwipeFile,
    handleRrssCreateSwipeFile,
    handleRrssUpdateSwipeFile,
    handleRrssDeleteSwipeFile,
    handleRrssListHypotheses,
    handleRrssCreateHypothesis,
    handleRrssUpdateHypothesis,
    handleRrssDeleteHypothesis,
    handleRrssListCampaignBriefs,
    handleRrssCreateCampaignBrief,
    handleRrssUpdateCampaignBrief,
    handleRrssDeleteCampaignBrief
} from "./rrss.js";


function getContainer(binding, name = "cf-singleton-container") {
    if (!binding) {
        throw new Error("Container binding not configured");
    }
    const objectId = binding.idFromName(name);
    return binding.get(objectId);
}


const MAX_BODY_SIZE =
    10 * 1024;

const RATE_LIMIT_WINDOW_SECONDS =
    60;

const RATE_LIMIT_MAX_REQUESTS =
    5;


function getClientIp(request) {

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


async function hashValue(value) {

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
                result?.request_count || 1
            );

        return {
            allowed:
                requestCount <=
                RATE_LIMIT_MAX_REQUESTS,

            retryAfter:
                RATE_LIMIT_WINDOW_SECONDS -
                (
                    now -
                    windowStart
                )
        };

    } catch {

        return {
            allowed: true,
            retryAfter: 0
        };
    }
}


async function handleHealth(
    request
) {

    if (
        request.method !==
        "GET"
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
        service:
            "alfonso-landing",
        version:
            "3.0.0"
    });
}


async function handleLead(
    request,
    env
) {

    if (
        request.method !==
        "POST"
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
            JSON.parse(
                rawBody
            );

    } catch {

        return errorResponse(
            "INVALID_JSON",
            "Request body must contain valid JSON.",
            400
        );
    }

    const validation =
        validateLead(
            payload
        );

    if (
        !validation.valid
    ) {

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

    if (
        !rateLimit.allowed
    ) {

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

    let isAlreadyRegistered = false;

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

            isAlreadyRegistered = true;

        } else {

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
    }

    /*
     * Envío automático de correo de bienvenida y confirmación
     * desde hola@alfonsoaikonta.com
     */
    let emailResult = null;

    try {

        emailResult =
            await sendBetaWelcomeEmail(
                {
                    name: lead.name,
                    email: lead.email
                },
                env
            );

        if (
            emailResult?.success &&
            env.alfonso_leads
        ) {

            try {

                await env.alfonso_leads
                    .prepare(
                        `
                        UPDATE leads
                        SET confirmation_email_sent = 1,
                            confirmation_email_sent_at = ?,
                            confirmation_email_provider = ?
                        WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
                        `
                    )
                    .bind(
                        new Date().toISOString(),
                        emailResult.provider || "dev_mock",
                        lead.email
                    )
                    .run();

            } catch (updateErr) {

                console.warn(
                    "Could not update confirmation email columns:",
                    updateErr.message
                );
            }
        }

    } catch (emailErr) {

        console.error(
            "Error in welcome email dispatch:",
            emailErr
        );
    }

    return successResponse(
        {
            message:
                isAlreadyRegistered
                    ? "This email is already registered."
                    : "Lead received successfully.",
            emailSent:
                Boolean(
                    emailResult?.success
                )
        },
        isAlreadyRegistered ? 200 : 202
    );
}


/*
 * ============================================================
 * INVOICE BACKEND
 * ============================================================
 *
 * La factura NO se procesa en JavaScript.
 *
 * El Worker recibe la petición y la entrega
 * al Container de Python.
 *
 * Flujo:
 *
 * factura
 *    ↓
 * Cloudflare Worker
 *    ↓
 * Python / FastAPI
 *    ↓
 * extracción LOCAL
 *    ↓
 * anonimización LOCAL
 *    ↓
 * Gemini
 *    ↓
 * respuesta
 */


async function handleInvoiceDemo(
    request,
    env
) {

    if (
        request.method !==
        "POST"
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
        ) || "";

    if (
        !contentType
            .toLowerCase()
            .startsWith(
                "multipart/form-data"
            )
    ) {

        return errorResponse(
            "UNSUPPORTED_MEDIA_TYPE",
            "Invoice endpoint requires multipart/form-data.",
            415
        );
    }

    const container =
        getContainer(
            env.INVOICE_CONTAINER,
            "alfonso-invoice"
        );

    return container.fetch(
        request
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
        "/api/invoice-demo"
    ) {

        return handleInvoiceDemo(
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
        "/api/guide/chat"
    ) {
        return handleGuideChat(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/admin/guide/stats"
    ) {
        return handleAdminGuideStats(
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

    if (
        leadIdMatch
    ) {

        return handleAdminLeadDetail(
            request,
            env,
            Number(
                leadIdMatch[1]
            )
        );
    }

    // --- Rutas de RRSS ---
    if (
        url.pathname ===
        "/api/rrss/login"
    ) {
        return handleRrssLogin(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/logout"
    ) {
        return handleRrssLogout(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/me"
    ) {
        return handleRrssMe(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/generate"
    ) {
        return handleRrssGenerate(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/generate-batch"
    ) {
        return handleRrssGenerateBatch(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/publications/batch" &&
        request.method === "POST"
    ) {
        return handleRrssCreatePublicationsBatch(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/trends" &&
        request.method === "GET"
    ) {
        return handleRrssGetTrends(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/competitors" &&
        request.method === "GET"
    ) {
        return handleRrssGetCompetitors(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/competitors" &&
        request.method === "POST"
    ) {
        return handleRrssCreateCompetitor(
            request,
            env
        );
    }

    if (
        url.pathname.startsWith("/api/rrss/competitors/") &&
        request.method === "PUT"
    ) {
        return handleRrssUpdateCompetitor(
            request,
            env
        );
    }

    if (
        url.pathname.startsWith("/api/rrss/competitors/") &&
        request.method === "DELETE"
    ) {
        return handleRrssDeleteCompetitor(
            request,
            env
        );
    }

    // --- Rutas de Swipe File (rrss_swipe_file) ---
    if (
        url.pathname === "/api/rrss/swipe-file" &&
        request.method === "GET"
    ) {
        return handleRrssListSwipeFile(request, env);
    }

    if (
        url.pathname === "/api/rrss/swipe-file" &&
        request.method === "POST"
    ) {
        return handleRrssCreateSwipeFile(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/swipe-file/") &&
        request.method === "PUT"
    ) {
        return handleRrssUpdateSwipeFile(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/swipe-file/") &&
        request.method === "DELETE"
    ) {
        return handleRrssDeleteSwipeFile(request, env);
    }

    // --- Rutas de Hipótesis (rrss_hypotheses) ---
    if (
        url.pathname === "/api/rrss/hypotheses" &&
        request.method === "GET"
    ) {
        return handleRrssListHypotheses(request, env);
    }

    if (
        url.pathname === "/api/rrss/hypotheses" &&
        request.method === "POST"
    ) {
        return handleRrssCreateHypothesis(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/hypotheses/") &&
        request.method === "PUT"
    ) {
        return handleRrssUpdateHypothesis(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/hypotheses/") &&
        request.method === "DELETE"
    ) {
        return handleRrssDeleteHypothesis(request, env);
    }

    // --- Rutas de Campaign Briefs (rrss_campaign_briefs) ---
    if (
        url.pathname === "/api/rrss/campaign-briefs" &&
        request.method === "GET"
    ) {
        return handleRrssListCampaignBriefs(request, env);
    }

    if (
        url.pathname === "/api/rrss/campaign-briefs" &&
        request.method === "POST"
    ) {
        return handleRrssCreateCampaignBrief(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/campaign-briefs/") &&
        request.method === "PUT"
    ) {
        return handleRrssUpdateCampaignBrief(request, env);
    }

    if (
        url.pathname.startsWith("/api/rrss/campaign-briefs/") &&
        request.method === "DELETE"
    ) {
        return handleRrssDeleteCampaignBrief(request, env);
    }

    if (
        url.pathname ===
        "/api/rrss/publications" &&
        request.method === "GET"
    ) {
        return handleRrssListPublications(
            request,
            env
        );
    }

    if (
        url.pathname ===
        "/api/rrss/publications" &&
        request.method === "POST"
    ) {
        return handleRrssCreatePublication(
            request,
            env
        );
    }

    const rrssPubIdMatch =
        url.pathname.match(
            /^\/api\/rrss\/publications\/(\d+)$/
        );

    if (
        rrssPubIdMatch
    ) {
        const pubId = Number(rrssPubIdMatch[1]);
        if (request.method === "PUT") {
            return handleRrssUpdatePublication(
                request,
                env,
                pubId
            );
        }
        if (request.method === "DELETE") {
            return handleRrssDeletePublication(
                request,
                env,
                pubId
            );
        }
    }

    return errorResponse(
        "NOT_FOUND",
        "API endpoint not found.",
        404
    );
}