import { Container } from "@cloudflare/containers";
import { env } from "cloudflare:workers";

export class InvoiceContainer extends Container {

    defaultPort = 8080;

    sleepAfter = "10m";

    enableInternet = true;

    pingEndpoint = "health";

    envVars = {
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        GEMINI_MODEL_NAME:
            env.GEMINI_MODEL_NAME ||
            "gemini-3.1-flash-lite"
    };
}