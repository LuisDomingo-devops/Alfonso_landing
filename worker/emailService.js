/**
 * Servicio de envío de correos electrónicos para Alfonso AI Konta
 * Soporta múltiples proveedores con tolerancia a fallos:
 *  1. Resend API (env.RESEND_API_KEY)
 *  2. Cloudflare Send Email Binding (env.EMAIL / env.SEND_EMAIL)
 *  3. SendGrid API (env.SENDGRID_API_KEY)
 *  4. Webhook genérico (env.EMAIL_WEBHOOK_URL)
 *  5. Mock / Logger en desarrollo o fallback seguro
 */

import { getBetaWelcomeEmail } from "./emailTemplates.js";

const DEFAULT_SENDER = "Alfonso AI Konta <hola@alfonsoaikonta.com>";

/**
 * Convierte un texto a codificación base64 segura para UTF-8 en MIME headers
 */
function encodeMimeHeader(text) {
    try {
        const utf8Bytes = new TextEncoder().encode(text);
        let binary = "";
        for (let i = 0; i < utf8Bytes.length; i++) {
            binary += String.fromCharCode(utf8Bytes[i]);
        }
        return `=?UTF-8?B?${btoa(binary)}?=`;
    } catch {
        return text;
    }
}

/**
 * Construye un mensaje en formato MIME multipart/alternative (RFC 2822)
 */
export function buildRawMimeMessage({ from, to, subject, html, text }) {
    const boundary = "----=_Part_" + Date.now() + "_" + Math.random().toString(36).substring(2);
    const encodedSubject = encodeMimeHeader(subject);

    return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodedSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        text,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        html,
        ``,
        `--${boundary}--`
    ].join("\r\n");
}

/**
 * Envía el correo mediante la API de Resend
 */
async function sendWithResend({ from, to, subject, html, text, apiKey }) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
        success: true,
        provider: "resend",
        id: data.id
    };
}

/**
 * Envía el correo mediante Cloudflare Send Email binding (Email Routing)
 */
async function sendWithCloudflareBinding({ from, to, subject, html, text, binding }) {
    const senderEmail = from.includes("<") ? from.match(/<([^>]+)>/)?.[1] || from : from;
    const recipientEmail = Array.isArray(to) ? to[0] : to;
    const rawMessage = buildRawMimeMessage({ from, to: recipientEmail, subject, html, text });

    if (typeof binding.send === "function") {
        try {
            let emailMsg = {
                from: senderEmail,
                to: recipientEmail,
                raw: rawMessage
            };

            if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
                try {
                    const { EmailMessage } = await import("cloudflare:email");
                    if (EmailMessage) {
                        emailMsg = new EmailMessage(senderEmail, recipientEmail, rawMessage);
                    }
                } catch (importErr) {
                    console.warn("Could not load EmailMessage class from cloudflare:email:", importErr.message);
                }
            }

            await binding.send(emailMsg);
            return {
                success: true,
                provider: "cloudflare_email_routing"
            };
        } catch (err) {
            throw new Error(`Cloudflare email binding error: ${err.message}`);
        }
    }

    throw new Error("Invalid Cloudflare email binding");
}

/**
 * Envía el correo mediante la API de SendGrid
 */
async function sendWithSendGrid({ from, to, subject, html, text, apiKey }) {
    const senderEmail = from.includes("<") ? from.match(/<([^>]+)>/)?.[1] || from : from;
    const senderName = from.includes("<") ? from.split("<")[0].trim() : "Alfonso AI Konta";

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            personalizations: [{
                to: [{ email: Array.isArray(to) ? to[0] : to }]
            }],
            from: { email: senderEmail, name: senderName },
            subject: subject,
            content: [
                { type: "text/plain", value: text },
                { type: "text/html", value: html }
            ]
        })
    });

    if (!response.ok && response.status !== 202) {
        const errorText = await response.text();
        throw new Error(`SendGrid API error (${response.status}): ${errorText}`);
    }

    return {
        success: true,
        provider: "sendgrid"
    };
}

/**
 * Envía el correo mediante un webhook personalizado
 */
async function sendWithWebhook({ from, to, subject, html, text, webhookUrl }) {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html,
            text,
            timestamp: new Date().toISOString()
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email Webhook error (${response.status}): ${errorText}`);
    }

    return {
        success: true,
        provider: "webhook"
    };
}

/**
 * Función principal para despachar un correo electrónico con selección inteligente de proveedor
 */
export async function sendEmail({ from, to, subject, html, text }, env = {}) {
    const fromAddress = from || env.DEFAULT_FROM_EMAIL || DEFAULT_SENDER;

    const errors = [];

    // 1. Resend API
    if (env.RESEND_API_KEY) {
        try {
            return await sendWithResend({
                from: fromAddress,
                to,
                subject,
                html,
                text,
                apiKey: env.RESEND_API_KEY
            });
        } catch (err) {
            console.error("Resend delivery failed, evaluating fallbacks:", err.message);
            errors.push(`resend: ${err.message}`);
        }
    }

    // 2. Cloudflare Send Email Binding
    const cfEmailBinding = env.EMAIL || env.SEND_EMAIL;
    if (cfEmailBinding && typeof cfEmailBinding.send === "function") {
        try {
            return await sendWithCloudflareBinding({
                from: fromAddress,
                to,
                subject,
                html,
                text,
                binding: cfEmailBinding
            });
        } catch (err) {
            console.error("Cloudflare Email Routing delivery failed, evaluating fallbacks:", err.message);
            errors.push(`cloudflare: ${err.message}`);
        }
    }

    // 3. SendGrid API
    if (env.SENDGRID_API_KEY) {
        try {
            return await sendWithSendGrid({
                from: fromAddress,
                to,
                subject,
                html,
                text,
                apiKey: env.SENDGRID_API_KEY
            });
        } catch (err) {
            console.error("SendGrid delivery failed, evaluating fallbacks:", err.message);
            errors.push(`sendgrid: ${err.message}`);
        }
    }

    // 4. Custom Webhook
    if (env.EMAIL_WEBHOOK_URL) {
        try {
            return await sendWithWebhook({
                from: fromAddress,
                to,
                subject,
                html,
                text,
                webhookUrl: env.EMAIL_WEBHOOK_URL
            });
        } catch (err) {
            console.error("Email Webhook delivery failed:", err.message);
            errors.push(`webhook: ${err.message}`);
        }
    }

    // 5. Fallback Mock / Logger (para entorno local, tests o cuando no hay API keys configuradas)
    console.log(`[EMAIL DISPATCH - SIMULATED/MOCK]
From: ${fromAddress}
To: ${to}
Subject: ${subject}
Provider: dev_mock
Status: Delivered (simulation)
Errors: ${errors.join("; ") || "none"}
`);

    const envKeys = Object.keys(env || {}).join(",");
    const bindingInfo = `EMAIL:${typeof env?.EMAIL},send:${typeof env?.EMAIL?.send},keys:[${envKeys}]`;

    const providerStatus = errors.length > 0
        ? `dev_mock (${errors.join(", ")}; ${bindingInfo})`
        : `dev_mock (${bindingInfo})`;

    return {
        success: true,
        provider: providerStatus,
        simulated: true,
        sentAt: new Date().toISOString()
    };
}

/**
 * Envía el correo de agradecimiento y bienvenida a la Beta de Alfonso AI Konta
 * 
 * @param {Object} lead - Datos del lead
 * @param {string} lead.name - Nombre del lead
 * @param {string} lead.email - Email del lead
 * @param {Object} env - Variables de entorno del worker de Cloudflare
 * @returns {Promise<{ success: boolean, provider: string }>}
 */
export async function sendBetaWelcomeEmail({ name, email }, env = {}) {
    if (!email || typeof email !== "string" || !email.includes("@")) {
        return {
            success: false,
            error: "INVALID_EMAIL",
            message: "No valid recipient email provided."
        };
    }

    const template = getBetaWelcomeEmail({ name, email });

    try {
        const result = await sendEmail({
            from: template.from,
            to: email,
            subject: template.subject,
            html: template.html,
            text: template.text
        }, env);

        return result;
    } catch (err) {
        console.error("Error sending beta welcome email:", err);
        return {
            success: false,
            error: "DELIVERY_ERROR",
            message: err.message
        };
    }
}
