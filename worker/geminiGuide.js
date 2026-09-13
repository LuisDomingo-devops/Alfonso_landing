import {
    successResponse,
    errorResponse
} from "./responses.js";

import {
    authenticateAdmin,
    unauthorized
} from "./admin.js";

import {
    sendBetaWelcomeEmail
} from "./emailService.js";

const MAX_MESSAGE_LENGTH = 1200;
const PRIMARY_GEMINI_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `Eres Alfonso, el asesor comercial y dependiente virtual de "Alfonso AI Konta" (alfonso.app).
Estás atendiendo en directo a una persona que entra en la web de Alfonso. Tu trato es exactamente el de un dependiente atento, profesional, cercano y de absoluta confianza en una tienda de calidad: escuchas activamente, dialogas con calidez y resuelves dudas con naturalidad.

IDENTIDAD, TONO Y LENGUAJE:
- Hablas en español peninsular 100% natural, fluido, directo y coloquial-profesional (ej. "¡Hola, buenas! Qué tal", "Claro, te entiendo perfectamente", "Eso nos pasa a casi todos los autónomos").
- NADA de lenguaje robótico, ni 'spanglish', ni jerga corporativa vacía.
- PROHIBICIÓN ESTRICTA: NO uses listas de viñetas, ni cuestionarios numerados, ni menús rígidos de opciones. Mantén siempre una conversación humana fluida y continua.
- Tus intervenciones deben ser ágiles y amenas: entre 2 y 4 frases o párrafos cortos conversacionales por turno. Si el usuario te cuenta algo largo, responde a lo que dice y hazle una pregunta natural de vuelta para seguir el hilo.

CONOCIMIENTO CLAVE DE ALFONSO:
1. ¿Qué hace Alfonso?: Es un asistente de IA para autónomos y pequeñas empresas en España que se encarga del trabajo sucio: lee tickets y facturas (incluso fotos arrugadas), extrae IVA, retenciones y proveedores, concilia con movimientos del banco y prepara los borradores de impuestos.
2. Filosofía central: "Tú decides, Alfonso lo hace". La IA hace el trabajo repetitivo, pero tú tienes el control y la última palabra. Cero automatismos a ciegas.
3. Compatibilidad con gestorías: Alfonso NO sustituye al gestor de confianza del cliente. Le prepara la información limpia y categorizada para que nadie pierda fines de semana picando facturas a mano.
4. Ley y Veri*Factu*: Diseñado para la normativa española de factura electrónica y sistemas Veri*Factu.
5. Privacidad y Seguridad: Arquitectura Local-First. Privacidad por diseño, sin cookies ni venta de datos.
6. Beta Privada Gratuita: Actualmente estamos en acceso anticipado 100% gratuito para los primeros 50 autónomos seleccionados, con soporte directo 1 a 1 de los fundadores. Más adelante la suscripción rondará los 39 €/mes, pero los primeros tendrán condiciones preferentes.

CIERRE Y CAPTURA NATURAL DE LEADS:
- No seas agresivo vendiendo. Si el visitante muestra interés o pregunta cómo probarlo, ofrécele con amabilidad guardarle una de las plazas de la beta gratuita y pídele su correo electrónico.
- SI EL CLIENTE TE ESCRIBE SU CORREO ELECTRÓNICO (ej. maria@gmail.com):
  * Agradece la confianza con alegría y calidez.
  * Confírmale claramente que su invitación a la beta privada ha quedado anotada.
  * Invítale con naturalidad a probar la demo interactiva de subida de facturas que hay en la página mientras le activamos el acceso.

REGLAS FUNDAMENTALES:
- Habla siempre como un dependiente humano de confianza.
- Adapta tus ejemplos al oficio que te mencione el usuario (fontanería, diseño, taller, abogacía, comercio, etc.).
- Nunca rompas el personaje.`;

function extractEmail(text) {
    if (!text || typeof text !== "string") return null;
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase().trim() : null;
}

function getGeminiKey(env) {
    return env.GEMINI_API_KEY || env.GOOGLE_API_KEY || null;
}

function getOpenRouterKey(env) {
    return env.OPENROUTER_API_KEY || null;
}

/**
 * Llamada primaria a Google Generative AI API
 */
async function callGemini(apiKey, modelName, contents) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents,
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            generationConfig: {
                temperature: 0.75,
                maxOutputTokens: 600
            }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

/**
 * Llamada secundaria de respaldo a OpenRouter
 */
async function callOpenRouter(apiKey, messages) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://alfonso.app",
            "X-Title": "Alfonso Guide"
        },
        body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
                { role: "system", content: SYSTEM_INSTRUCTION },
                ...messages
            ],
            temperature: 0.75,
            max_tokens: 600
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || "";
}

export async function handleGuideChat(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { message, history = [], section = "", sessionId = "anon" } = body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
        return errorResponse("VALIDATION_ERROR", "Message is required.", 400);
    }

    const userMessage = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    const safeSessionId = String(sessionId).slice(0, 64);
    const safeSection = String(section).slice(0, 50);

    const geminiKey = getGeminiKey(env);
    const openRouterKey = getOpenRouterKey(env);
    const configuredModel = env.GEMINI_MODEL_NAME || PRIMARY_GEMINI_MODEL;

    let assistantResponse = "";
    let detectedEmail = extractEmail(userMessage);

    // Preparar historial para la llamada
    const geminiContents = [];
    const openRouterMessages = [];

    if (Array.isArray(history)) {
        for (const turn of history.slice(-8)) {
            if (turn.role && turn.text) {
                const role = turn.role === "user" ? "user" : "model";
                const cleanText = String(turn.text).slice(0, 1000);
                geminiContents.push({
                    role,
                    parts: [{ text: cleanText }]
                });
                openRouterMessages.push({
                    role: turn.role === "user" ? "user" : "assistant",
                    content: cleanText
                });
            }
        }
    }

    const contextPrefix = safeSection ? `[Nota de contexto visual: el cliente está navegando por la sección "${safeSection}"]\n` : "";
    const fullUserPrompt = `${contextPrefix}${userMessage}`;

    geminiContents.push({
        role: "user",
        parts: [{ text: fullUserPrompt }]
    });
    openRouterMessages.push({
        role: "user",
        content: fullUserPrompt
    });

    // 1. Intentar con modelo configurado de Gemini
    if (geminiKey) {
        try {
            assistantResponse = await callGemini(geminiKey, configuredModel, geminiContents);
        } catch (err1) {
            console.warn(`Primary Gemini model (${configuredModel}) failed:`, err1.message);
            // Intentar con modelo secundario de Gemini si el primero falló
            try {
                assistantResponse = await callGemini(geminiKey, FALLBACK_GEMINI_MODEL, geminiContents);
            } catch (err2) {
                console.warn(`Secondary Gemini model (${FALLBACK_GEMINI_MODEL}) failed:`, err2.message);
            }
        }
    }

    // 2. Fallback a OpenRouter si Gemini no respondió
    if (!assistantResponse && openRouterKey) {
        try {
            assistantResponse = await callOpenRouter(openRouterKey, openRouterMessages);
        } catch (orErr) {
            console.error("OpenRouter fallback failed:", orErr.message);
        }
    }

    // 3. Fallback conversacional humano dinámico si la red o las claves fallaran
    if (!assistantResponse) {
        assistantResponse = generateConversationalFallback(userMessage, safeSection, detectedEmail);
    }

    // Detectar si el email fue extraído o devuelto en la conversación
    if (!detectedEmail) {
        detectedEmail = extractEmail(assistantResponse);
    }

    // Si hay un email, registrar como lead en D1
    let leadCaptured = false;
    if (detectedEmail && env.alfonso_leads) {
        try {
            await env.alfonso_leads.prepare(`
                INSERT INTO leads (name, email, company, message, source)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    message = leads.message || ' | Conversación guía en ' || datetime('now'),
                    updated_at = datetime('now')
            `).bind(
                "Lead Beta (Asistente en Vivo)",
                detectedEmail,
                `Captado en sección ${safeSection || 'web'}`,
                `Conversación: "${userMessage.slice(0, 200)}"`,
                "alfonso_guide_store"
            ).run();
            leadCaptured = true;

            // Disparar correo de bienvenida desde hola@alfonsoaikonta.com
            try {
                const emailRes = await sendBetaWelcomeEmail({
                    name: "Futuro Betatester",
                    email: detectedEmail
                }, env);

                if (emailRes?.success) {
                    try {
                        await env.alfonso_leads.prepare(`
                            UPDATE leads
                            SET confirmation_email_sent = 1,
                                confirmation_email_sent_at = ?,
                                confirmation_email_provider = ?
                            WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
                        `).bind(
                            new Date().toISOString(),
                            emailRes.provider || "dev_mock",
                            detectedEmail
                        ).run();
                    } catch {
                        // Continuar si la columna no existe aún
                    }
                }
            } catch (mailErr) {
                console.error("Error sending welcome email from guide:", mailErr);
            }
        } catch (dbErr) {
            console.error("Error saving lead from guide chat:", dbErr);
        }
    }

    // Registrar interacción en D1 para telemetría sin cookies
    if (env.alfonso_leads) {
        try {
            await env.alfonso_leads.prepare(`
                INSERT INTO guide_interactions (session_id, user_message, assistant_response, section, lead_email)
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                safeSessionId,
                userMessage,
                assistantResponse,
                safeSection,
                detectedEmail || null
            ).run();
        } catch (dbErr) {
            console.warn("Could not insert into guide_interactions:", dbErr.message);
        }
    }

    return successResponse({
        response: assistantResponse,
        leadCaptured,
        leadEmail: detectedEmail || null
    });
}

/**
 * Fallback natural conversacional por si ocurre una caída total de conexión
 */
function generateConversationalFallback(message, section, email) {
    if (email) {
        return `¡Estupendo! Me he apuntado tu correo (${email}) para reservarte una plaza en la Beta privada gratuita de Alfonso. Te escribiremos en cuanto te habilitemos el acceso para acompañarte 1 a 1. Mientras tanto, si quieres puedes probar la demo interactiva que tenemos en la página.`;
    }

    const lower = message.toLowerCase();

    if (lower.includes("gestor") || lower.includes("asesor") || lower.includes("contable")) {
        return "Alfonso no está pensado para que dejes a tu gestor de toda la vida, sino todo lo contrario: le deja todo el papeleo organizado y masticado para que ninguno de los dos perdáis horas picando facturas a final de trimestre. ¿Cómo soléis pasarle los papeles ahora mismo?";
    }

    if (lower.includes("precio") || lower.includes("cuesta") || lower.includes("gratis") || lower.includes("cuanto") || lower.includes("cuánto")) {
        return "Ahora mismo el acceso a la Beta Privada es 100% gratuito para los primeros 50 autónomos seleccionados, con soporte directo con nosotros. Cuando lancemos la versión final rondará los 39 €/mes, pero si entras ahora tendrás condiciones ventajosas de por vida. Si quieres, déjame tu correo y te guardo una invitación.";
    }

    if (lower.includes("verifactu") || lower.includes("hacienda") || lower.includes("ley")) {
        return "Está diseñado desde el primer día para adaptarse a la normativa española de factura electrónica y a los requisitos de Veri*Factu, para que no tengas que preocuparte por cambios legales. ¿Gestionas muchas facturas cada mes?";
    }

    return "¡Hola! Cuenta conmigo para lo que necesites. En Alfonso nos encargamos de que no tengas que pelearte con tickets ni facturas a mano, manteniendo tú siempre el control de cada dato. Cuéntame, ¿a qué te dedicas en tu día a día o qué es lo que más tiempo te quita del papeleo?";
}

export async function handleAdminGuideStats(request, env) {
    const isAuthenticated = await authenticateAdmin(request, env);
    if (!isAuthenticated) {
        return unauthorized();
    }

    try {
        const interactionsRes = await env.alfonso_leads.prepare(`
            SELECT id, session_id, user_message, assistant_response, section, lead_email, created_at
            FROM guide_interactions
            ORDER BY id DESC
            LIMIT 50
        `).all();

        const statsRes = await env.alfonso_leads.prepare(`
            SELECT 
                COUNT(*) as total_questions,
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(lead_email) as total_leads_captured
            FROM guide_interactions
        `).first();

        const sectionStatsRes = await env.alfonso_leads.prepare(`
            SELECT section, COUNT(*) as count
            FROM guide_interactions
            WHERE section != ''
            GROUP BY section
            ORDER BY count DESC
            LIMIT 10
        `).all();

        return successResponse({
            stats: statsRes || { total_questions: 0, total_sessions: 0, total_leads_captured: 0 },
            sections: sectionStatsRes?.results || [],
            interactions: interactionsRes?.results || []
        });
    } catch (err) {
        return successResponse({
            stats: { total_questions: 0, total_sessions: 0, total_leads_captured: 0 },
            sections: [],
            interactions: [],
            note: "La tabla guide_interactions aún no contiene registros o no está inicializada."
        });
    }
}

