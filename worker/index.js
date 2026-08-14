import {
    handleApiRequest
} from "./router.js";

import {
    getCorsHeaders,
    handleCorsPreflight
} from "./cors.js";

import {
    handleApiError
} from "./errors.js";

import {
    applySecurityHeaders
} from "./security.js";

import {
    InvoiceContainer
} from "./invoice_container.js";


const API_PREFIX =
    "/api";


export default {

    async fetch(
        request,
        env
    ) {

        try {

            const url =
                new URL(request.url);

            if (
                url.pathname.startsWith(
                    `${API_PREFIX}/`
                )
            ) {

                if (
                    request.method ===
                    "OPTIONS"
                ) {

                    const preflightResponse =
                        handleCorsPreflight(
                            request
                        );

                    if (
                        preflightResponse
                    ) {

                        return applySecurityHeaders(
                            preflightResponse
                        );
                    }

                    return new Response(
                        null,
                        {
                            status: 403
                        }
                    );
                }

                const response =
                    await handleApiRequest(
                        request,
                        env
                    );

                const corsHeaders =
                    getCorsHeaders(
                        request
                    );

                const responseWithCors =
                    new Response(
                        response.body,
                        {
                            status:
                                response.status,

                            statusText:
                                response.statusText,

                            headers: {
                                ...Object.fromEntries(
                                    response.headers
                                ),

                                ...corsHeaders
                            }
                        }
                    );

                return applySecurityHeaders(
                    responseWithCors
                );
            }

            const assetResponse =
                await env.ASSETS.fetch(
                    request
                );

            return applySecurityHeaders(
                assetResponse
            );

        } catch (error) {

            console.error(
                "Worker error:",
                error
            );

            return applySecurityHeaders(
                handleApiError(
                    error
                )
            );
        }
    }
};


/*
 * Cloudflare Containers necesita que la clase
 * esté exportada desde el Worker.
 */

export {
    InvoiceContainer
};