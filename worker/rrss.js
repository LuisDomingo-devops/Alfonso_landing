import {
    successResponse,
    errorResponse
} from "./responses.js";

const SESSION_COOKIE = "alfonso_rrss_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas
const MAX_BODY_SIZE = 4096;

const PRIMARY_GEMINI_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_GEMINI_MODEL = "gemini-2.5-flash";

const ALFONSO_PRODUCT_CONTEXT = `Alfonso AI Konta (alfonso.app) es un asistente de IA para autónomos y pequeñas empresas en España que se encarga del trabajo administrativo y fiscal:
- Lee tickets y facturas (incluso fotos arrugadas), extrayendo IVA, retenciones y proveedores de forma automatizada.
- Concilia facturas con movimientos bancarios.
- Prepara borradores de modelos de impuestos.
- Filosofía central: "Tú decides, Alfonso lo hace" (la IA hace el trabajo repetitivo, pero el autónomo conserva el control y tiene la última palabra).
- Compatibilidad con gestorías: No sustituye al gestor tradicional, sino que le prepara la información limpia y categorizada para evitar que el autónomo pierda su fin de semana picando facturas.
- Cumple con la normativa española de factura electrónica y sistemas Veri*Factu.
- Enfoque Local-First, priorizando la privacidad y la seguridad sin cookies ni venta de datos.
- Precio del producto: Ronda los 39 €/mes, aunque actualmente hay una beta privada gratuita para los primeros 50 autónomos.`;

const ALFONSO_SEO_NICHE_CONTEXT = `NICHO DE MERCADO Y PÚBLICO OBJETIVO:
- Target: Autónomos, freelances y micro-pymes en España.
- Principales dolores e intereses demandados por el público objetivo:
  * Ahorrar tiempo en tareas administrativas y papeleo fiscal para recuperar los fines de semana.
  * Miedo a errores en la presentación de impuestos (IVA Modelo 303, IRPF Modelo 130, etc.) y sanciones de Hacienda.
  * Saber con precisión qué gastos son realmente deducibles (vehículo, suministros de casa, comidas de trabajo, teléfono, etc.).
  * La entrada en vigor de la Factura Electrónica obligatoria y la ley Veri*Factu en España.
  * Conciliación bancaria ágil y control de cobros.
- Palabras clave SEO recomendadas a integrar de forma orgánica: autónomos, facturación electrónica, gastos deducibles, impuestos autónomos, ahorrar tiempo, IVA, IRPF, Hacienda, gestoría online, Veri*Factu, contabilidad autónomos.

ESTRATEGIA TEMÁTICA Y FORMATO POR PLATAFORMA (SEO SOCIAL):
- LinkedIn: Enfoque corporativo y profesional. Temáticas de digitalización, productividad, análisis de normativas fiscales, optimización de costes y marca personal. Estructura con gancho SEO potente ("scroll stopper"), desarrollo con viñetas espaciadas y llamada a la acción profesional.
- X/Twitter: Enfoque conversacional, directo y ágil. Hilos rápidos, debates o reflexiones sobre la burocracia en España, consejos cortos accionables y empatía/humor de autónomos. Copys muy breves (<280 caracteres), con hashtags de alta conversión integrados en el texto.
- Instagram: Enfoque educativo y visual. Explicaciones paso a paso tipo carrusel (ej: "Cómo deducir tu internet como autónomo", "3 errores al facturar"), tips prácticos, uso de emojis estructurado y bloque de hashtags estratégicos al final.
- Facebook: Enfoque comunitario y cercano. Historias reales de emprendedores, preguntas interactivas que inviten a comentar (ej: "¿Cómo llevas el papeleo de este trimestre?") y explicaciones sencillas y amigables.`;

// --- Utilitarios de Sesión y Criptografía ---

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=UTF-8",
                "Cache-Control": "no-store",
                ...headers
            }
        }
    );
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return null;

    for (const cookie of cookieHeader.split(";")) {
        const separator = cookie.indexOf("=");
        if (separator === -1) continue;

        const key = cookie.slice(0, separator).trim();
        if (key !== name) continue;

        return cookie.slice(separator + 1).trim();
    }
    return null;
}

function createSessionCookie(token, maxAge) {
    return [
        `${SESSION_COOKIE}=${token}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        `Max-Age=${maxAge}`
    ].join("; ");
}

async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function createToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

function constantTimeEqual(first, second) {
    if (typeof first !== "string" || typeof second !== "string") {
        return false;
    }
    if (first.length !== second.length) {
        return false;
    }
    let difference = 0;
    for (let index = 0; index < first.length; index++) {
        difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
    }
    return difference === 0;
}

async function verifyPassword(password, expectedPassword) {
    if (typeof password !== "string" || typeof expectedPassword !== "string") {
        return false;
    }
    const suppliedHash = await sha256(password);
    const expectedHash = await sha256(expectedPassword);
    return constantTimeEqual(suppliedHash, expectedHash);
}

function unauthorized() {
    return jsonResponse(
        {
            success: false,
            error: {
                code: "UNAUTHORIZED",
                message: "Acceso no autorizado. Inicia sesión en RRSS."
            }
        },
        401
    );
}

// --- Autenticación ---

export async function authenticateRrss(request, env) {
    const token = getCookie(request, SESSION_COOKIE);
    if (!token) return false;

    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);

    try {
        const session = await env.alfonso_leads
            .prepare(
                `
                SELECT id
                FROM rrss_sessions
                WHERE token_hash = ?
                AND expires_at > ?
                LIMIT 1
                `
            )
            .bind(tokenHash, now)
            .first();

        return Boolean(session);
    } catch (error) {
        console.error("Rrss authentication error:", error);
        return false;
    }
}

// --- Controladores de Sesión ---

export async function handleRrssLogin(request, env) {
    if (request.method !== "POST") {
        return jsonResponse(
            { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
            405,
            { Allow: "POST" }
        );
    }

    let payload;
    try {
        const rawBody = await request.text();
        if (rawBody.length > MAX_BODY_SIZE) {
            return jsonResponse(
                { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large." } },
                413
            );
        }
        payload = JSON.parse(rawBody);
    } catch {
        return jsonResponse(
            { success: false, error: { code: "INVALID_JSON", message: "Invalid JSON." } },
            400
        );
    }

    const password = payload?.password;
    // Si no hay RRSS_PASSWORD en env, hacemos fallback a ADMIN_PASSWORD. En desarrollo usamos 'rrss_dev_pass' o 'admin'
    const expectedPassword = env.RRSS_PASSWORD || env.ADMIN_PASSWORD || "rrss_dev_pass";

    const valid = await verifyPassword(password, expectedPassword);
    if (!valid) {
        return jsonResponse(
            { success: false, error: { code: "INVALID_CREDENTIALS", message: "Contraseña incorrecta." } },
            401
        );
    }

    const token = await createToken();
    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + SESSION_TTL_SECONDS;

    try {
        // Limpiar sesiones expiradas
        await env.alfonso_leads
            .prepare("DELETE FROM rrss_sessions WHERE expires_at <= ?")
            .bind(now)
            .run();

        // Registrar nueva sesión
        await env.alfonso_leads
            .prepare(
                `
                INSERT INTO rrss_sessions (token_hash, created_at, expires_at)
                VALUES (?, ?, ?)
                `
            )
            .bind(tokenHash, now, expiresAt)
            .run();
    } catch (error) {
        console.error("Rrss session creation error:", error);
        return jsonResponse(
            { success: false, error: { code: "SESSION_ERROR", message: "No se pudo crear la sesión." } },
            500
        );
    }

    return jsonResponse(
        { success: true, data: { authenticated: true } },
        200,
        {
            "Set-Cookie": createSessionCookie(token, SESSION_TTL_SECONDS)
        }
    );
}

export async function handleRrssLogout(request, env) {
    if (request.method !== "POST") {
        return jsonResponse(
            { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
            405,
            { Allow: "POST" }
        );
    }

    const token = getCookie(request, SESSION_COOKIE);
    if (token) {
        const tokenHash = await sha256(token);
        try {
            await env.alfonso_leads
                .prepare("DELETE FROM rrss_sessions WHERE token_hash = ?")
                .bind(tokenHash)
                .run();
        } catch (error) {
            console.error("Rrss logout error:", error);
        }
    }

    return jsonResponse(
        { success: true, data: { authenticated: false } },
        200,
        {
            "Set-Cookie": createSessionCookie("", 0)
        }
    );
}

export async function handleRrssMe(request, env) {
    if (request.method !== "GET") {
        return jsonResponse(
            { success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } },
            405,
            { Allow: "GET" }
        );
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    return jsonResponse({
        success: true,
        data: { authenticated: true }
    });
}

// --- Integración con la API de Gemini ---

async function callGeminiRaw(apiKey, modelName, systemInstruction, promptText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: promptText }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 1200
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

export async function handleRrssGenerate(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { platform, topic, tone, keywords = "", length = "mediana", campaignBriefId = null } = body || {};

    if (!platform || !topic || !tone) {
        return errorResponse("VALIDATION_ERROR", "Campos platform, topic y tone son obligatorios.", 400);
    }

    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || null;
    if (!apiKey) {
        return errorResponse("CONFIGURATION_ERROR", "Gemini API key no configurada.", 500);
    }

    const modelName = env.GEMINI_MODEL_NAME || PRIMARY_GEMINI_MODEL;

    // Buscar briefing creativo si aplica
    let briefContext = "";
    if (campaignBriefId) {
        try {
            const brief = await env.alfonso_leads
                .prepare("SELECT * FROM rrss_campaign_briefs WHERE id = ?")
                .bind(campaignBriefId)
                .first();
            if (brief) {
                briefContext = `\nEste post se enmarca dentro de una campaña estructurada propia. Debes basarte estrictamente en los siguientes lineamientos estratégicos:
- Campaña: "${brief.name}"
- Objetivo de la campaña: "${brief.goal}"
- Audiencia objetivo: "${brief.audience}"
- Problema central: "${brief.problem}"
- Deseo a activar: "${brief.desire}"
- Insight clave: "${brief.insight || "No provisto"}"
- Ángulo de comunicación: "${brief.angle}"
- Hook a utilizar: "${brief.hook}"
- Promesa principal: "${brief.promise}"
- Mecanismo que lo hace posible: "${brief.mechanism}"
- Prueba social / Argumento: "${brief.proof || "No provisto"}"
- Oferta asociada: "${brief.offer || "No provista"}"
- CTA específico: "${brief.cta}"
- Formato a emular: "${brief.format || "No especificado"}"
- Landing page de destino: "${brief.landing || "No provista"}"
- KPI de éxito: "${brief.primary_kpi}"

Instrucción crucial de copia:
Asegúrate de estructurar el copy del post de forma que use de forma original y persuasiva el ángulo, hook, promesa y mecanismo definidos en la campaña. No inventes otros problemas o promesas que desvíen la atención del foco definido. Sigue la regla fundamental: "Copiar el aprendizaje estratégico, no el contenido de otros".`;
            }
        } catch (dbErr) {
            console.error("Error consultando el briefing creativo:", dbErr);
        }
    }

    // Construcción del System Instruction y el Prompt
    const systemInstruction = `Eres un copywriter experto y redactor de marketing de contenidos especializado en redes sociales.
Tu objetivo es crear publicaciones sumamente atractivas, profesionales y optimizadas para la red social indicada, orientadas a promocionar o dar valor en torno al producto "Alfonso AI Konta".

Información clave sobre el producto Alfonso AI Konta:
${ALFONSO_PRODUCT_CONTEXT}

Guía de Nicho, SEO Social y Estrategia Temática:
${ALFONSO_SEO_NICHE_CONTEXT}

Instrucciones:
- Adapta el tono de voz solicitado (ej. profesional, persuasivo, humorístico, técnico, divertido).
- Enfoca la publicación en el tema o idea central proporcionado por el usuario, pero modélala y optimízala siguiendo la Guía de Nicho y SEO Social para la plataforma seleccionada.
- No añadas explicaciones sobre el proceso ni introducciones meta-textuales. Devuelve únicamente el texto final de la publicación.
${briefContext}`;

    const promptText = ``;

    let generatedText = "";
    try {
        generatedText = await callGeminiRaw(apiKey, modelName, systemInstruction, promptText);
    } catch (error) {
        console.warn(`Primary Gemini model (${modelName}) failed:`, error.message);
        // Fallback a modelo secundario si falla
        try {
            generatedText = await callGeminiRaw(apiKey, FALLBACK_GEMINI_MODEL, systemInstruction, promptText);
        } catch (fallbackErr) {
            console.error("Secondary Gemini model fallback failed:", fallbackErr.message);
            return errorResponse("API_ERROR", "Error al conectar con la API de generación de contenidos de Gemini.", 502);
        }
    }

    return successResponse({
        content: generatedText,
        platform,
        topic,
        tone
    });
}

// --- CRUD de Publicaciones en SQLite D1 ---

export async function handleRrssListPublications(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    try {
        const publications = await env.alfonso_leads
            .prepare("SELECT * FROM rrss_publications ORDER BY created_at DESC")
            .all();

        return successResponse({
            publications: publications?.results || []
        });
    } catch (error) {
        console.error("Database error listing publications:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo obtener el historial de publicaciones.", 500);
    }
}

export async function handleRrssCreatePublication(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { platform, topic, tone, content, status = "draft", scheduled_at = null } = body || {};

    if (!platform || !topic || !tone || !content) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const result = await env.alfonso_leads
            .prepare(
                `
                INSERT INTO rrss_publications (platform, topic, tone, content, status, created_at, updated_at, scheduled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                `
            )
            .bind(platform, topic, tone, content, status, now, now, scheduled_at)
            .first();

        return successResponse({
            message: "Publicación guardada correctamente.",
            id: result?.id
        }, 201);
    } catch (error) {
        console.error("Database error saving publication:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo guardar la publicación.", 500);
    }
}

export async function handleRrssUpdatePublication(request, env, id) {
    if (request.method !== "PUT") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "PUT" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { platform, topic, tone, content, status, scheduled_at = null } = body || {};

    if (!platform || !topic || !tone || !content || !status) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios para actualizar.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const result = await env.alfonso_leads
            .prepare(
                `
                UPDATE rrss_publications
                SET platform = ?, topic = ?, tone = ?, content = ?, status = ?, updated_at = ?, scheduled_at = ?
                WHERE id = ?
                `
            )
            .bind(platform, topic, tone, content, status, now, scheduled_at, id)
            .run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "La publicación no existe.", 404);
        }

        return successResponse({
            message: "Publicación actualizada correctamente."
        });
    } catch (error) {
        console.error("Database error updating publication:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo actualizar la publicación.", 500);
    }
}

export async function handleRrssDeletePublication(request, env, id) {
    if (request.method !== "DELETE") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "DELETE" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    try {
        const result = await env.alfonso_leads
            .prepare("DELETE FROM rrss_publications WHERE id = ?")
            .bind(id)
            .run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "La publicación no existe.", 404);
        }

        return successResponse({
            message: "Publicación eliminada correctamente."
        });
    } catch (error) {
        console.error("Database error deleting publication:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo eliminar la publicación.", 500);
    }
}

// --- Generación por Lotes de Publicaciones ---

export async function handleRrssGenerateBatch(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { platforms, topic, tone, month, year, countPerPlatform = 4, trends, campaignBriefId = null } = body || {};

    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || null;
    if (!apiKey) {
        return errorResponse("CONFIGURATION_ERROR", "Gemini API key no configurada.", 500);
    }

    const modelName = env.GEMINI_MODEL_NAME || PRIMARY_GEMINI_MODEL;

    // Buscar briefing creativo si aplica
    let campaignBrief = null;
    let briefContext = "";
    if (campaignBriefId) {
        try {
            campaignBrief = await env.alfonso_leads
                .prepare("SELECT * FROM rrss_campaign_briefs WHERE id = ?")
                .bind(campaignBriefId)
                .first();
            if (campaignBrief) {
                briefContext = `\nEste lote de publicaciones se enmarca dentro de una campaña estructurada propia. Debes basarte estrictamente en los siguientes lineamientos estratégicos:
- Campaña: "${campaignBrief.name}"
- Objetivo de la campaña: "${campaignBrief.goal}"
- Audiencia objetivo: "${campaignBrief.audience}"
- Problema central: "${campaignBrief.problem}"
- Deseo a activar: "${campaignBrief.desire}"
- Insight clave: "${campaignBrief.insight || "No provisto"}"
- Ángulo de comunicación principal: "${campaignBrief.angle}"
- Hook conceptual: "${campaignBrief.hook}"
- Promesa principal: "${campaignBrief.promise}"
- Mecanismo que lo hace posible: "${campaignBrief.mechanism}"
- Prueba social / Argumento: "${campaignBrief.proof || "No provisto"}"
- Oferta asociada: "${campaignBrief.offer || "No provista"}"
- CTA específico: "${campaignBrief.cta}"
- Formato a emular: "${campaignBrief.format || "No especificado"}"
- Landing page de destino: "${campaignBrief.landing || "No provista"}"
- KPI principal de éxito: "${campaignBrief.primary_kpi}"

Instrucción de variación y testeo:
1. Genera variaciones y copys basados en el briefing.
2. Alterna entre los diferentes dolores de la audiencia (ahorro de tiempo, costes y reducción de errores descritos en el briefing).
3. Adapta y varía los hooks de entrada (usando la taxonomía del SOP: ganchos de problema, de resultado, contrarian, curiosidad, etc.) pero siempre apuntando a la promesa y el mecanismo del briefing.
4. Genera las variantes distribuidas equilibradamente para separar variables en las plataformas. Sigue el principio fundamental del SOP: "Copiar el aprendizaje, no el contenido".`;
            }
        } catch (dbErr) {
            console.error("Error consultando el briefing creativo para lote:", dbErr);
        }
    }

    const finalTopic = topic || campaignBrief?.name || "";

    if (!Array.isArray(platforms) || platforms.length === 0 || !finalTopic || !tone || !month || !year) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios: platforms, topic/briefing, tone, month, year.", 400);
    }

    const systemInstruction = `Eres un copywriter experto y redactor de marketing de contenidos especializado en redes sociales.
Tu objetivo es planificar y crear un calendario de publicaciones atractivas para varias redes sociales a lo largo de un mes específico, orientadas a promocionar o aportar valor en relación al producto "Alfonso AI Konta".

Información clave sobre el producto Alfonso AI Konta:
${ALFONSO_PRODUCT_CONTEXT}

Guía de Nicho, SEO Social y Estrategia Temática:
${ALFONSO_SEO_NICHE_CONTEXT}

Instrucciones:
- Adapta el tono de voz solicitado y crea publicaciones altamente atractivas.
- Elige temáticas de publicación específicas basadas en los dolores e intereses del nicho (como gastos deducibles, digitalización, conciliación, ahorro de tiempo), adaptando el ángulo temático según lo que mejor funciona en cada red social.
- Optimiza los copys para SEO Social (titular scroll-stopper, palabras clave relevantes y estructura nativa).
- Debes responder ÚNICAMENTE con un objeto JSON estructurado que cumpla con el siguiente esquema JSON:
{
  "publications": [
    {
      "platform": "Nombre de la plataforma (LinkedIn, X/Twitter, Instagram o Facebook)",
      "day": 10,
      "topic": "Tema o gancho del post",
      "content": "Contenido completo de la publicación"
    }
  ]
}
Asegúrate de que la propiedad 'day' sea un número entero válido (del 1 al 28). No devuelvas explicaciones ni markdown. Devuelve únicamente el string JSON válido.
${briefContext}`;

    let trendsPromptSection = "";
    if (trends && (Array.isArray(trends.monthlyTrends) || Array.isArray(trends.weeklyTrends))) {
        let competitorSection = "";
        if (Array.isArray(trends.competitorAnalysis) && trends.competitorAnalysis.length > 0) {
            competitorSection = `\nEstrategias y Estructuras Exitosas de la Competencia para emular:
${trends.competitorAnalysis.map(c => `  * Competidor: "${c.competitor}" | Tema Exitoso: "${c.postTopic}" | Engagement: ${c.engagement} | Estructura/Fórmula recomendada: "${c.strategy}"`).join("\n")}

Instrucciones de emulación competitiva:
- Analiza el estilo, formato visual, distribución del copy y ganchos de persuasión de las publicaciones exitosas de la competencia listadas arriba.
- Copia y emula esa estructura exitosa de comunicación en los posts generados en este lote para Alfonso AI Konta, pero dándole la vuelta al argumento para posicionar a Alfonso como la alternativa superior.`;
        }

        trendsPromptSection = `\nDistribución de Temas Populares en el Nicho de Autónomos España para este mes:
- Tendencias del Mes:
${(trends.monthlyTrends || []).map(t => `  * Tema: "${t.topic}" | Sentiment: ${t.sentiment} | Engagement Estimado: ${t.engagementRate} | Canal Recomendado: ${t.bestPlatform} | Popularidad (Likes/Comments): ${t.avgLikes}/${t.avgComments} | Tendencia: ${t.status}`).join("\n")}
- Tendencias de la Semana:
${(trends.weeklyTrends || []).map(t => `  * Tema: "${t.topic}" | Sentiment: ${t.sentiment} | Engagement Estimado: ${t.engagementRate} | Canal Recomendado: ${t.bestPlatform} | Popularidad (Likes/Comments): ${t.avgLikes}/${t.avgComments} | Tendencia: ${t.status}`).join("\n")}
${competitorSection}

Instrucciones para la distribución de temas:
1. No limites el calendario de publicaciones solo al tema mensual indicado ("${topic}"). Debes mezclar, alternar y distribuir los posts entre el tema central indicado y los temas populares listados arriba.
2. La proporción de publicaciones dedicadas a cada tema popular en el calendario debe ser DIRECTAMENTE PROPORCIONAL al interés que genera (los temas con mayor Engagement, Popularidad y tendencia 'up' deben ocupar una mayor proporción del total de posts generados).
3. Asigna de forma prioritaria cada tema popular a la red social que figura como su 'Canal Recomendado' o 'bestPlatform' cuando esta haya sido seleccionada por el usuario.
4. Adapta la psicología y el copywriting de cada post al "Sentiment" (sentimiento) indicado para esa tendencia. Utiliza empatía táctica para conectar emocionalmente con el autónomo (ej: si es Frustración, valida su agobio con las facturas los dos domingos; si es Incertidumbre, aclara sus dudas con tono firme) y posiciona a Alfonso AI Konta como la solución que genera Alivio y control contable.`;
    } else {
        trendsPromptSection = `\nDistribuye las temáticas de las publicaciones basándose en los dolores comunes de los autónomos (como gastos deducibles, ley Veri*Factu, contabilidad simplificada, IVA/IRPF) de forma variada a lo largo del calendario, adaptando el peso de los temas a lo que es más demandado en general (siendo la deducción de gastos y la factura electrónica los de mayor interés).`;
    }

    const promptText = `Genera un plan de publicaciones en lote.
Tema del mes o idea central del mes: "${topic}".
Tono deseado: "${tone}".
Mes de planificación: "${month}" y Año: "${year}".
Plataformas deseadas: [${platforms.join(", ")}].
Cantidad de publicaciones por plataforma: ${countPerPlatform}.

Distribuye las publicaciones de manera equilibrada a lo largo del mes utilizando días entre el 1 y el 28. Asegúrate de que los posts de cada plataforma estén separados en días diferentes para no saturar al público.
${trendsPromptSection}

Requisitos de contenido:
1. Adapta la temática de cada post a la plataforma específica (LinkedIn, X/Twitter, Instagram, Facebook) según lo que es más demandado en cada una.
2. Incorpora los intereses del nicho de autónomos (impuestos, gastos deducibles, factura electrónica, conciliación) relacionándolo con el tema mensual.
3. Utiliza técnicas de SEO social (palabras clave relevantes, ganchos potentes de lectura rápida y hashtags optimizados).`;

    let generatedText = "";
    try {
        // Para asegurar que Gemini devuelva JSON, podemos pasarle la opción responseMimeType
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } catch (error) {
        console.warn(`Primary Gemini model (${modelName}) failed in batch generation:`, error.message);
        // Fallback a modelo secundario si falla
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FALLBACK_GEMINI_MODEL)}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) {
                throw new Error(`Gemini fallback HTTP ${res.status}`);
            }

            const data = await res.json();
            generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        } catch (fallbackErr) {
            console.error("Secondary Gemini model fallback failed in batch generation:", fallbackErr.message);
            return errorResponse("API_ERROR", "Error al conectar con la API de generación de contenidos de Gemini.", 502);
        }
    }

    let parsedResult;
    try {
        parsedResult = JSON.parse(generatedText);
    } catch {
        try {
            // Limpiar si hay bloques de código markdown
            const cleanText = generatedText.replace(/```json/gi, "").replace(/```/g, "").trim();
            parsedResult = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error("Failed to parse Gemini batch response:", generatedText);
            return errorResponse("API_ERROR", "La IA generó una respuesta estructurada inválida.", 502);
        }
    }

    const publicationsList = parsedResult?.publications || [];
    const formattedPublications = [];

    const intMonth = parseInt(month, 10);
    const intYear = parseInt(year, 10);

    for (const pub of publicationsList) {
        const day = parseInt(pub.day, 10) || 1;
        // Asignar timestamp para el día indicado a las 10:00 AM
        const dateObj = new Date(intYear, intMonth - 1, day, 10, 0, 0);
        const scheduledAt = Math.floor(dateObj.getTime() / 1000);

        formattedPublications.push({
            platform: pub.platform || platforms[0],
            topic: pub.topic || topic,
            tone: tone,
            content: pub.content || "",
            scheduled_at: scheduledAt,
            status: "draft"
        });
    }

    return successResponse({
        publications: formattedPublications
    });
}

export async function handleRrssCreatePublicationsBatch(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { publications } = body || {};

    if (!Array.isArray(publications) || publications.length === 0) {
        return errorResponse("VALIDATION_ERROR", "El campo publications debe ser un array no vacío.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const statements = publications.map(pub => {
            const platform = pub.platform;
            const topic = pub.topic;
            const tone = pub.tone;
            const content = pub.content;
            const status = pub.status || "draft";
            const scheduledAt = pub.scheduled_at || null;

            return env.alfonso_leads.prepare(
                `
                INSERT INTO rrss_publications (platform, topic, tone, content, status, created_at, updated_at, scheduled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).bind(platform, topic, tone, content, status, now, now, scheduledAt);
        });

        await env.alfonso_leads.batch(statements);

        return successResponse({
            message: `Se han guardado ${publications.length} publicaciones correctamente.`
        }, 201);
    } catch (error) {
        console.error("Database error saving publications batch:", error);
        return errorResponse("DATABASE_ERROR", "No se pudieron guardar las publicaciones en lote.", 500);
    }
}

// --- Reporte de Tendencias y Métricas del Nicho ---

async function fetchFeedNews(url, maxCount = 3) {
    if (!url) return [];
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/xml, text/xml, */*"
            }
        });
        if (!res.ok) return [];
        const xml = await res.text();
        const items = [];
        const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of matches) {
            const content = match[1];
            const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
            const descMatch = content.match(/<description>([\s\S]*?)<\/description>/);
            if (titleMatch) {
                const title = titleMatch[1]
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
                    .replace(/&lt;.*?&gt;/g, "")
                    .replace(/<.*?>/g, "")
                    .trim();
                const desc = descMatch ? descMatch[1]
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
                    .replace(/&lt;.*?&gt;/g, "")
                    .replace(/<.*?>/g, "")
                    .trim() : "";
                items.push({ title, desc });
            }
            if (items.length >= maxCount) break;
        }
        return items;
    } catch (err) {
        console.error(`Error fetching feed from ${url}:`, err);
        return [];
    }
}

export async function handleRrssGetTrends(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }

    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) {
        return unauthorized();
    }

    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || null;
    if (!apiKey) {
        return errorResponse("CONFIGURATION_ERROR", "Gemini API key no configurada.", 500);
    }

    const modelName = env.GEMINI_MODEL_NAME || PRIMARY_GEMINI_MODEL;

    // Obtener mes y año actual en español para pasarlo en el prompt
    const now = new Date();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMonthText = meses[now.getMonth()];
    const currentYear = now.getFullYear();

    // Obtener noticias reales de autónomos en España para guiar el análisis
    const realNews = await fetchFeedNews("https://www.autonomosyemprendedor.es/rss/articulos.xml", 6);
    let newsPromptSection = "";
    if (realNews.length > 0) {
        newsPromptSection = `\nPara este análisis, debes basarte OBLIGATORIAMENTE en las siguientes novedades y noticias reales extraídas en tiempo real hoy del sector de autónomos y fiscal en España:
${realNews.map((n, i) => `${i+1}. TÍTULO: "${n.title}" | RESUMEN: "${n.desc.substring(0, 150)}..."`).join("\n")}

Instrucción crucial:
Analiza los temas de estas noticias reales y utilízalas como el origen directo para formular tus temas clave de tendencias mensuales ("monthlyTrends") y semanales ("weeklyTrends"). Estima las métricas (likes, comments, engagement) y el sentimiento social correspondiente según la relevancia de cada noticia real en la vida del autónomo.`;
    }

    // Obtener competidores desde la base de datos D1
    let competitors = [];
    try {
        const { results } = await env.alfonso_leads.prepare("SELECT * FROM rrss_competitors").all();
        competitors = results || [];
    } catch (dbErr) {
        console.error("Error consultando competidores en base de datos:", dbErr);
    }

    // Fallback de competidores si la DB está vacía
    if (competitors.length === 0) {
        competitors = [
            { name: "Declarando", rss_blog_url: "https://declarando.es/blog/feed/", rss_social_url: "https://nitter.net/Declarando_es/rss" },
            { name: "Holded", rss_blog_url: "https://www.holded.com/es/blog/feed/", rss_social_url: "" }
        ];
    }

    // Recopilar noticias y publicaciones de cada competidor
    const allCompetitorNews = [];
    for (const comp of competitors) {
        if (comp.rss_blog_url) {
            const blogNews = await fetchFeedNews(comp.rss_blog_url, 2);
            blogNews.forEach(n => {
                allCompetitorNews.push({
                    competitor: comp.name,
                    source: "Blog/Web",
                    title: n.title,
                    desc: n.desc
                });
            });
        }
        if (comp.rss_social_url) {
            const socialNews = await fetchFeedNews(comp.rss_social_url, 2);
            socialNews.forEach(n => {
                allCompetitorNews.push({
                    competitor: comp.name,
                    source: "Redes Sociales",
                    title: n.title,
                    desc: n.desc
                });
            });
        }
    }

    let competitorPromptSection = "";
    if (allCompetitorNews.length > 0) {
        competitorPromptSection = `\nÚltimas publicaciones y contenidos detectados de tus competidores directos en España (como Declarando y Holded):
${allCompetitorNews.map((n, i) => `${i+1}. COMPETIDOR: "${n.competitor}" | CANAL: "${n.source}" | TÍTULO: "${n.title}" | RESUMEN: "${n.desc.substring(0, 150)}..."`).join("\n")}

Instrucción crucial de competencia:
Analiza qué temas y dolores están atacando estos competidores. Formula estrategias específicas de contra-marketing para Alfonso AI Konta para superar estos enfoques, posicionando a Alfonso como la alternativa superior.`;
    }

    const systemInstruction = `Eres un analista de marketing digital y estratega de redes sociales especializado en el nicho de autónomos, freelances y micro-pymes en España.
Tu tarea es generar un informe detallado de las tendencias, temas candentes e intereses más demandados con métricas estimadas de redes sociales para este nicho para el mes y la semana en curso (${currentMonthText} de ${currentYear}). El análisis debe incluir un análisis de sentimiento explícito sobre cómo se siente el público objetivo ante cada temática.
${newsPromptSection}
${competitorPromptSection}

Debes responder ÚNICAMENTE con un objeto JSON estructurado que cumpla exactamente con el mosquito/esquema JSON:
{
  "monthlyTrends": [
    {
      "topic": "Tema clave del mes en el nicho basado en las noticias reales (ej: Gastos de gasolina deducibles)",
      "engagementRate": "84%",
      "avgLikes": 150,
      "avgComments": 42,
      "bestPlatform": "LinkedIn",
      "status": "up", // opciones obligatorias: "up" (tendencia alza), "stable" (estable), "down" (tendencia baja)
      "sentiment": "Frustración" // opciones obligatorias: "Frustración", "Incertidumbre", "Alivio", "Curiosidad", "Interés"
    }
  ],
  "weeklyTrends": [
    {
      "topic": "Tema caliente de la semana actual basado en las noticias reales (ej: Factura electrónica obligatoria)",
      "engagementRate": "92%",
      "avgLikes": 85,
      "avgComments": 28,
      "bestPlatform": "X/Twitter",
      "status": "up",
      "sentiment": "Incertidumbre"
    }
  ],
  "competitorAnalysis": [
    {
      "competitor": "Nombre del competidor (ej: Declarando)",
      "postTopic": "El tema principal sobre el que publicó la competencia (ej: Declaración de la renta para autónomos societarios)",
      "engagement": "Alto", // opciones obligatorias: "Alto", "Medio", "Bajo"
      "strategy": "Estrategia de copywriting para Alfonso para superar este contenido (ej: Escribir un post comparando el coste y lentitud de gestores tradicionales frente a la automatización fiscal total de Alfonso)."
    }
  ]
}

No devuelvas introducciones, explicaciones ni markdown. Devuelve únicamente el string JSON válido. Genera entre 3 y 4 elementos en monthlyTrends y weeklyTrends, y entre 2 y 3 elementos realistas en competitorAnalysis.`;

    const promptText = `Genera el informe de tendencias y analítica del nicho de autónomos en España para el mes de ${currentMonthText} de ${currentYear} e indica cuáles son los temas más buscados e interactivos de la semana actual, con sus métricas estimadas de me gusta, comentarios y engagement.`;

    let generatedText = "";
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    temperature: 0.75,
                    maxOutputTokens: 1500,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } catch (error) {
        console.warn(`Primary Gemini model failed in trends generation:`, error.message);
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(FALLBACK_GEMINI_MODEL)}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        temperature: 0.75,
                        maxOutputTokens: 1500,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!res.ok) throw new Error("Gemini fallback failed");

            const data = await res.json();
            generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        } catch (fallbackErr) {
            console.error("Secondary Gemini model failed in trends generation:", fallbackErr.message);
            return errorResponse("API_ERROR", "Error al conectar con la API de generación de contenidos de Gemini.", 502);
        }
    }

    let parsedResult;
    try {
        parsedResult = JSON.parse(generatedText);
    } catch {
        try {
            const cleanText = generatedText.replace(/```json/gi, "").replace(/```/g, "").trim();
            parsedResult = JSON.parse(cleanText);
        } catch {
            return errorResponse("API_ERROR", "La IA generó un reporte de tendencias estructurado inválido.", 502);
        }
    }

    return successResponse({
        trends: parsedResult
    });
}

// --- CRUD de Competidores ---

export async function handleRrssGetCompetitors(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    try {
        const { results } = await env.alfonso_leads.prepare("SELECT * FROM rrss_competitors ORDER BY id DESC").all();
        return successResponse({ competitors: results || [] });
    } catch (error) {
        console.error("Error fetching competitors:", error);
        return errorResponse("DATABASE_ERROR", "No se pudieron obtener los competidores.", 500);
    }
}

export async function handleRrssCreateCompetitor(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const { name, rss_blog_url = "", rss_social_url = "" } = body || {};
    if (!name) {
        return errorResponse("VALIDATION_ERROR", "El nombre del competidor es obligatorio.", 400);
    }

    try {
        const now = Math.floor(Date.now() / 1000);
        const { success } = await env.alfonso_leads.prepare(
            "INSERT INTO rrss_competitors (name, rss_blog_url, rss_social_url, created_at) VALUES (?, ?, ?, ?)"
        ).bind(name, rss_blog_url, rss_social_url, now).run();

        if (!success) {
            return errorResponse("DATABASE_ERROR", "No se pudo insertar el competidor.", 500);
        }
        return successResponse({ message: "Competidor registrado con éxito." }, 201);
    } catch (error) {
        console.error("Error creating competitor:", error);
        return errorResponse("DATABASE_ERROR", "Error al crear el competidor.", 500);
    }
}

export async function handleRrssDeleteCompetitor(request, env) {
    if (request.method !== "DELETE") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "DELETE" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID de competidor no válido.", 400);
    }

    try {
        const { success } = await env.alfonso_leads.prepare("DELETE FROM rrss_competitors WHERE id = ?").bind(id).run();
        if (!success) {
            return errorResponse("DATABASE_ERROR", "No se pudo eliminar el competidor.", 500);
        }
        return successResponse({ message: "Competidor eliminado correctamente." });
    } catch (error) {
        console.error("Error deleting competitor:", error);
        return errorResponse("DATABASE_ERROR", "Error al eliminar el competidor.", 500);
    }
}

// --- CRUD extendido de Competidores ---

export async function handleRrssUpdateCompetitor(request, env) {
    if (request.method !== "PUT") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "PUT" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID de competidor no válido.", 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        name,
        rss_blog_url = "",
        rss_social_url = "",
        type = "",
        target_audience = "",
        product = "",
        price = "",
        web_url = "",
        linkedin_url = "",
        instagram_url = "",
        tiktok_url = "",
        youtube_url = "",
        ads_url = "",
        positioning_we_are = "",
        positioning_help_who = "",
        positioning_get_what = "",
        positioning_by_how = "",
        positioning_differentiator = "",
        positioning_problem = "",
        positioning_promise = "",
        positioning_objection = ""
    } = body || {};

    if (!name) {
        return errorResponse("VALIDATION_ERROR", "El nombre del competidor es obligatorio.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare(
            `
            UPDATE rrss_competitors
            SET name = ?, rss_blog_url = ?, rss_social_url = ?, type = ?, target_audience = ?,
                product = ?, price = ?, web_url = ?, linkedin_url = ?, instagram_url = ?,
                tiktok_url = ?, youtube_url = ?, ads_url = ?, positioning_we_are = ?,
                positioning_help_who = ?, positioning_get_what = ?, positioning_by_how = ?,
                positioning_differentiator = ?, positioning_problem = ?, positioning_promise = ?,
                positioning_objection = ?
            WHERE id = ?
            `
        ).bind(
            name, rss_blog_url, rss_social_url, type, target_audience,
            product, price, web_url, linkedin_url, instagram_url,
            tiktok_url, youtube_url, ads_url, positioning_we_are,
            positioning_help_who, positioning_get_what, positioning_by_how,
            positioning_differentiator, positioning_problem, positioning_promise,
            positioning_objection, id
        ).run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "El competidor no existe o no tiene cambios.", 404);
        }

        return successResponse({ message: "Competidor actualizado correctamente." });
    } catch (error) {
        console.error("Error updating competitor:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo actualizar el competidor.", 500);
    }
}

// --- CRUD de Swipe File (rrss_swipe_file) ---

export async function handleRrssListSwipeFile(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    try {
        const { results } = await env.alfonso_leads.prepare(
            `
            SELECT s.*, c.name as competitor_name
            FROM rrss_swipe_file s
            LEFT JOIN rrss_competitors c ON s.competitor_id = c.id
            ORDER BY s.created_at DESC
            `
        ).all();
        return successResponse({ swipe_items: results || [] });
    } catch (error) {
        console.error("Error listing swipe file:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo obtener el Swipe File.", 500);
    }
}

export async function handleRrssCreateSwipeFile(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        competitor_id = null,
        platform,
        date_observed = "",
        url = "",
        type,
        file_name = "",
        notes = "",
        campaign_name = "",
        audience = "",
        problem = "",
        desire = "",
        hook = "",
        promise = "",
        mechanism = "",
        proof = "",
        offer = "",
        cta = "",
        landing = "",
        tone = "",
        objection = "",
        funnel_stage = "TOFU",
        psychology_flow = "",
        hook_class = "problema",
        scoring_repetition = 0,
        scoring_persistence = 0,
        scoring_differentiation = 0,
        scoring_relevance = 0,
        scoring_applicability = 0
    } = body || {};

    if (!platform || !type) {
        return errorResponse("VALIDATION_ERROR", "Campos platform y type son obligatorios.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const result = await env.alfonso_leads.prepare(
            `
            INSERT INTO rrss_swipe_file (
                competitor_id, platform, date_observed, url, type, file_name, notes,
                campaign_name, audience, problem, desire, hook, promise, mechanism,
                proof, offer, cta, landing, tone, objection, funnel_stage,
                psychology_flow, hook_class, scoring_repetition, scoring_persistence,
                scoring_differentiation, scoring_relevance, scoring_applicability, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            `
        ).bind(
            competitor_id, platform, date_observed, url, type, file_name, notes,
            campaign_name, audience, problem, desire, hook, promise, mechanism,
            proof, offer, cta, landing, tone, objection, funnel_stage,
            psychology_flow, hook_class, scoring_repetition, scoring_persistence,
            scoring_differentiation, scoring_relevance, scoring_applicability, now
        ).first();

        return successResponse({
            message: "Elemento de Swipe File guardado con éxito.",
            id: result?.id
        }, 201);
    } catch (error) {
        console.error("Error creating swipe file item:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo guardar el elemento de Swipe File.", 500);
    }
}

export async function handleRrssUpdateSwipeFile(request, env) {
    if (request.method !== "PUT") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "PUT" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const reqUrl = new URL(request.url);
    const pathParts = reqUrl.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        competitor_id = null,
        platform,
        date_observed = "",
        url = "",
        type,
        file_name = "",
        notes = "",
        campaign_name = "",
        audience = "",
        problem = "",
        desire = "",
        hook = "",
        promise = "",
        mechanism = "",
        proof = "",
        offer = "",
        cta = "",
        landing = "",
        tone = "",
        objection = "",
        funnel_stage = "TOFU",
        psychology_flow = "",
        hook_class = "problema",
        scoring_repetition = 0,
        scoring_persistence = 0,
        scoring_differentiation = 0,
        scoring_relevance = 0,
        scoring_applicability = 0
    } = body || {};

    if (!platform || !type) {
        return errorResponse("VALIDATION_ERROR", "Campos platform y type son obligatorios.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare(
            `
            UPDATE rrss_swipe_file
            SET competitor_id = ?, platform = ?, date_observed = ?, url = ?, type = ?,
                file_name = ?, notes = ?, campaign_name = ?, audience = ?, problem = ?,
                desire = ?, hook = ?, promise = ?, mechanism = ?, proof = ?, offer = ?,
                cta = ?, landing = ?, tone = ?, objection = ?, funnel_stage = ?,
                psychology_flow = ?, hook_class = ?, scoring_repetition = ?,
                scoring_persistence = ?, scoring_differentiation = ?, scoring_relevance = ?,
                scoring_applicability = ?
            WHERE id = ?
            `
        ).bind(
            competitor_id, platform, date_observed, url, type,
            file_name, notes, campaign_name, audience, problem,
            desire, hook, promise, mechanism, proof, offer,
            cta, landing, tone, objection, funnel_stage,
            psychology_flow, hook_class, scoring_repetition,
            scoring_persistence, scoring_differentiation, scoring_relevance,
            scoring_applicability, id
        ).run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "El elemento no existe o no tiene cambios.", 404);
        }

        return successResponse({ message: "Elemento de Swipe File actualizado correctamente." });
    } catch (error) {
        console.error("Error updating swipe file item:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo actualizar el elemento de Swipe File.", 500);
    }
}

export async function handleRrssDeleteSwipeFile(request, env) {
    if (request.method !== "DELETE") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "DELETE" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare("DELETE FROM rrss_swipe_file WHERE id = ?").bind(id).run();
        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "El elemento de Swipe File no existe.", 404);
        }
        return successResponse({ message: "Elemento de Swipe File eliminado correctamente." });
    } catch (error) {
        console.error("Error deleting swipe file item:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo eliminar el elemento de Swipe File.", 500);
    }
}

// --- CRUD de Hipótesis (rrss_hypotheses) ---

export async function handleRrssListHypotheses(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    try {
        const { results } = await env.alfonso_leads.prepare("SELECT * FROM rrss_hypotheses ORDER BY created_at DESC").all();
        return successResponse({ hypotheses: results || [] });
    } catch (error) {
        console.error("Error listing hypotheses:", error);
        return errorResponse("DATABASE_ERROR", "No se pudieron obtener las hipótesis.", 500);
    }
}

export async function handleRrssCreateHypothesis(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        observation,
        hypothesis,
        test,
        control,
        metric,
        expected_result,
        scoring_repetition = 0,
        scoring_persistence = 0,
        scoring_differentiation = 0,
        scoring_relevance = 0,
        scoring_applicability = 0,
        status = "pending"
    } = body || {};

    if (!observation || !hypothesis || !test || !control || !metric || !expected_result) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios para la hipótesis.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const result = await env.alfonso_leads.prepare(
            `
            INSERT INTO rrss_hypotheses (
                observation, hypothesis, test, control, metric, expected_result,
                scoring_repetition, scoring_persistence, scoring_differentiation,
                scoring_relevance, scoring_applicability, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            `
        ).bind(
            observation, hypothesis, test, control, metric, expected_result,
            scoring_repetition, scoring_persistence, scoring_differentiation,
            scoring_relevance, scoring_applicability, status, now
        ).first();

        return successResponse({
            message: "Hipótesis registrada con éxito.",
            id: result?.id
        }, 201);
    } catch (error) {
        console.error("Error creating hypothesis:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo registrar la hipótesis.", 500);
    }
}

export async function handleRrssUpdateHypothesis(request, env) {
    if (request.method !== "PUT") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "PUT" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        observation,
        hypothesis,
        test,
        control,
        metric,
        expected_result,
        scoring_repetition = 0,
        scoring_persistence = 0,
        scoring_differentiation = 0,
        scoring_relevance = 0,
        scoring_applicability = 0,
        status
    } = body || {};

    if (!observation || !hypothesis || !test || !control || !metric || !expected_result || !status) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios para actualizar la hipótesis.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare(
            `
            UPDATE rrss_hypotheses
            SET observation = ?, hypothesis = ?, test = ?, control = ?, metric = ?,
                expected_result = ?, scoring_repetition = ?, scoring_persistence = ?,
                scoring_differentiation = ?, scoring_relevance = ?, scoring_applicability = ?,
                status = ?
            WHERE id = ?
            `
        ).bind(
            observation, hypothesis, test, control, metric, expected_result,
            scoring_repetition, scoring_persistence, scoring_differentiation,
            scoring_relevance, scoring_applicability, status, id
        ).run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "La hipótesis no existe o no tiene cambios.", 404);
        }

        return successResponse({ message: "Hipótesis actualizada correctamente." });
    } catch (error) {
        console.error("Error updating hypothesis:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo actualizar la hipótesis.", 500);
    }
}

export async function handleRrssDeleteHypothesis(request, env) {
    if (request.method !== "DELETE") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "DELETE" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare("DELETE FROM rrss_hypotheses WHERE id = ?").bind(id).run();
        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "La hipótesis no existe.", 404);
        }
        return successResponse({ message: "Hipótesis eliminada correctamente." });
    } catch (error) {
        console.error("Error deleting hypothesis:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo eliminar la hipótesis.", 500);
    }
}

// --- CRUD de Campaign Briefs (rrss_campaign_briefs) ---

export async function handleRrssListCampaignBriefs(request, env) {
    if (request.method !== "GET") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "GET" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    try {
        const { results } = await env.alfonso_leads.prepare(
            `
            SELECT b.*, h.hypothesis as hypothesis_text
            FROM rrss_campaign_briefs b
            LEFT JOIN rrss_hypotheses h ON b.hypothesis_id = h.id
            ORDER BY b.created_at DESC
            `
        ).all();
        return successResponse({ briefs: results || [] });
    } catch (error) {
        console.error("Error listing briefs:", error);
        return errorResponse("DATABASE_ERROR", "No se pudieron obtener los briefings.", 500);
    }
}

export async function handleRrssCreateCampaignBrief(request, env) {
    if (request.method !== "POST") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "POST" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        hypothesis_id = null,
        name,
        goal,
        audience,
        problem,
        desire,
        insight = "",
        angle,
        hook,
        promise,
        mechanism,
        proof = "",
        offer = "",
        cta,
        format = "",
        landing = "",
        primary_kpi
    } = body || {};

    if (!name || !goal || !audience || !problem || !desire || !angle || !hook || !promise || !mechanism || !cta || !primary_kpi) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios para el briefing de campaña.", 400);
    }

    const now = Math.floor(Date.now() / 1000);

    try {
        const result = await env.alfonso_leads.prepare(
            `
            INSERT INTO rrss_campaign_briefs (
                hypothesis_id, name, goal, audience, problem, desire, insight,
                angle, hook, promise, mechanism, proof, offer, cta, format,
                landing, primary_kpi, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            `
        ).bind(
            hypothesis_id, name, goal, audience, problem, desire, insight,
            angle, hook, promise, mechanism, proof, offer, cta, format,
            landing, primary_kpi, now
        ).first();

        return successResponse({
            message: "Briefing de campaña guardado con éxito.",
            id: result?.id
        }, 201);
    } catch (error) {
        console.error("Error creating campaign brief:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo registrar el briefing de campaña.", 500);
    }
}

export async function handleRrssUpdateCampaignBrief(request, env) {
    if (request.method !== "PUT") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "PUT" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const {
        hypothesis_id = null,
        name,
        goal,
        audience,
        problem,
        desire,
        insight = "",
        angle,
        hook,
        promise,
        mechanism,
        proof = "",
        offer = "",
        cta,
        format = "",
        landing = "",
        primary_kpi
    } = body || {};

    if (!name || !goal || !audience || !problem || !desire || !angle || !hook || !promise || !mechanism || !cta || !primary_kpi) {
        return errorResponse("VALIDATION_ERROR", "Faltan campos obligatorios para actualizar el briefing de campaña.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare(
            `
            UPDATE rrss_campaign_briefs
            SET hypothesis_id = ?, name = ?, goal = ?, audience = ?, problem = ?,
                desire = ?, insight = ?, angle = ?, hook = ?, promise = ?,
                mechanism = ?, proof = ?, offer = ?, cta = ?, format = ?,
                landing = ?, primary_kpi = ?
            WHERE id = ?
            `
        ).bind(
            hypothesis_id, name, goal, audience, problem, desire, insight,
            angle, hook, promise, mechanism, proof, offer, cta, format,
            landing, primary_kpi, id
        ).run();

        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "El briefing de campaña no existe o no tiene cambios.", 404);
        }

        return successResponse({ message: "Briefing de campaña actualizado correctamente." });
    } catch (error) {
        console.error("Error updating campaign brief:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo actualizar el briefing de campaña.", 500);
    }
}

export async function handleRrssDeleteCampaignBrief(request, env) {
    if (request.method !== "DELETE") {
        return errorResponse("METHOD_NOT_ALLOWED", "Method not allowed.", 405, { Allow: "DELETE" });
    }
    const authenticated = await authenticateRrss(request, env);
    if (!authenticated) return unauthorized();

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1], 10);

    if (isNaN(id)) {
        return errorResponse("VALIDATION_ERROR", "ID no válido.", 400);
    }

    try {
        const result = await env.alfonso_leads.prepare("DELETE FROM rrss_campaign_briefs WHERE id = ?").bind(id).run();
        if (result.meta?.changes === 0) {
            return errorResponse("NOT_FOUND", "El briefing de campaña no existe.", 404);
        }
        return successResponse({ message: "Briefing de campaña eliminado correctamente." });
    } catch (error) {
        console.error("Error deleting campaign brief:", error);
        return errorResponse("DATABASE_ERROR", "No se pudo eliminar el briefing de campaña.", 500);
    }
}



