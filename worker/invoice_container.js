import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class InvoiceContainer extends Container {
    defaultPort = 8080;

    enableInternet = true;

    pingEndpoint = "health";

    envVars = {
        GEMINI_API_KEY: env.GEMINI_API_KEY,

        GEMINI_MODEL_NAME:
            env.GEMINI_MODEL_NAME ||
            "gemini-3.1-flash-lite"
    };

    async fetch(request) {
        const url = new URL(request.url);

        /*
         * Health check del container.
         */
        if (url.pathname === "/health") {
            return new Response(
                JSON.stringify({
                    status: "ok",
                    service: "alfonso-invoice-container"
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        /*
         * El Container solo expone
         * el endpoint de procesamiento de facturas.
         */
        if (url.pathname !== "/api/invoice-demo") {
            return new Response(
                JSON.stringify({
                    error: "Endpoint not found"
                }),
                {
                    status: 404,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        return this.containerFetch(request);
    }
}