/**
 * Plantillas de correo electrónico para Alfonso AI Konta
 * Remitente oficial: hola@alfonsoaikonta.com
 */

function escapeHtml(str) {
    if (!str || typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Genera el asunto, HTML y texto plano del correo de bienvenida a la Beta.
 * 
 * @param {Object} params
 * @param {string} params.name - Nombre del usuario solicitante
 * @param {string} params.email - Dirección de correo del solicitante
 * @returns {{ subject: string, html: string, text: string, from: string }}
 */
export function getBetaWelcomeEmail({ name, email } = {}) {
    const rawName = (name && typeof name === "string" && name.trim() && name.trim().toLowerCase() !== "solicitante beta" && name.trim().toLowerCase() !== "lead asistente alfonso")
        ? name.trim()
        : "Futuro Betatester";

    const safeName = escapeHtml(rawName);
    const safeEmail = escapeHtml(email || "");

    const subject = "¡Bienvenido a la Beta de Alfonso AI Konta! 🚀 Tu acceso está en camino";
    const from = "Alfonso AI Konta <hola@alfonsoaikonta.com>";

    const text = `
¡Hola, ${rawName}!

Muchas gracias por solicitar tu acceso prioritario a la Beta privada de Alfonso AI Konta.

Hemos recibido correctamente tu solicitud vinculada al correo ${email || ""}. Estamos preparando y empaquetando tu versión del programa para que puedas probarlo directamente en tu equipo.

¿Qué es Alfonso AI Konta?
Alfonso es el agente contable con inteligencia artificial que se ejecuta 100% en local en tu ordenador:
• Máxima Privacidad: Tus facturas, nóminas y cuentas nunca salen de tu equipo ni se almacenan en servidores externos de terceros.
• Listo para Veri*Factu: Automatiza el registro inalterable y la generación de registros fiscales según la normativa española.
• Asistente Inteligente: Lee facturas en PDF/imágenes, clasifica gastos y concilia movimientos bancarios sin esfuerzo.

¿Qué ocurrirá a continuación?
En muy breve recibirás un segundo correo con el enlace de descarga del instalador y una guía rápida de 2 minutos para ponerlo en marcha.

Si tienes cualquier duda urgente, sugerencia o necesitas que tu acceso sea prioritario para tu empresa, puedes responder directamente a este correo o escribirnos a hola@alfonsoaikonta.com.

Un cordial saludo,
El equipo de Alfonso AI Konta
https://www.alfonsoaikonta.com
`.trim();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; color: #f1f5f9;">
    <!-- Contenedor Principal -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0b1120; min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 15px;">
                <!-- Tarjeta Central de Contenido -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #131d31; border: 1px solid #1e293b; border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); overflow: hidden;">
                    
                    <!-- Cabecera / Marca -->
                    <tr>
                        <td align="center" style="padding: 35px 30px 25px 30px; background: linear-gradient(180deg, #1e293b 0%, #131d31 100%); border-bottom: 1px solid #1e293b;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <div style="display: inline-block; padding: 8px 16px; background-color: rgba(45, 212, 191, 0.12); border: 1px solid rgba(45, 212, 191, 0.3); border-radius: 9999px; margin-bottom: 14px;">
                                            <span style="color: #2dd4bf; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Beta Privada • Acceso Prioritario</span>
                                        </div>
                                        <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                            Alfonso <span style="color: #2dd4bf;">AI Konta</span>
                                        </h1>
                                        <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px;">
                                            Contabilidad Inteligente, 100% Local y Privada
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Cuerpo del Mensaje -->
                    <tr>
                        <td style="padding: 35px 35px 25px 35px;">
                            <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                                ¡Hola, ${safeName}! 👋
                            </h2>
                            <p style="margin: 0 0 16px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                                Muchas gracias por solicitar tu acceso a la <strong>Beta privada gratuita</strong> de Alfonso AI Konta. Hemos registrado correctamente tu solicitud vinculada a <span style="color: #2dd4bf; font-weight: 600;">${safeEmail}</span>.
                            </p>
                            <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                                Estamos terminando de preparar y empaquetar tu versión del programa. <strong>En breve recibirás un nuevo correo con el enlace de descarga directo</strong> para que puedas instalarlo y empezar a probarlo en tu equipo.
                            </p>

                            <!-- Bloque Destacado: Qué recibirás -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <h3 style="margin: 0 0 12px 0; color: #38bdf8; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">
                                            🔒 Lo que hace único a Alfonso
                                        </h3>
                                        
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px;">
                                            <tr>
                                                <td width="28" valign="top" style="font-size: 16px;">💻</td>
                                                <td style="color: #e2e8f0; font-size: 14px; line-height: 1.4;">
                                                    <strong>100% Ejecución Local:</strong> Tus datos y facturas se procesan en tu propio ordenador. Privacidad total sin compartir información confidencial en la nube.
                                                </td>
                                            </tr>
                                        </table>

                                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 10px;">
                                            <tr>
                                                <td width="28" valign="top" style="font-size: 16px;">⚡</td>
                                                <td style="color: #e2e8f0; font-size: 14px; line-height: 1.4;">
                                                    <strong>Automatización y OCR:</strong> Lectura inteligente de facturas, extracción de impuestos y sugerencia de asientos contables en segundos.
                                                </td>
                                            </tr>
                                        </table>

                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="28" valign="top" style="font-size: 16px;">🏛️</td>
                                                <td style="color: #e2e8f0; font-size: 14px; line-height: 1.4;">
                                                    <strong>Cumplimiento Veri*Factu:</strong> Diseñado desde el inicio adaptado a la normativa tributaria española y registro inalterable.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Mensaje de soporte / contacto -->
                            <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                                ¿Tienes alguna pregunta o necesitas acceso urgente para un despacho o empresa? Puedes responder directamente a este email o contactar a <a href="mailto:hola@alfonsoaikonta.com" style="color: #2dd4bf; text-decoration: underline;">hola@alfonsoaikonta.com</a>.
                            </p>

                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-top: 10px; padding-bottom: 10px;">
                                        <a href="https://www.alfonsoaikonta.com" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(20, 184, 166, 0.35);">
                                            Visitar www.alfonsoaikonta.com
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Pie de Página -->
                    <tr>
                        <td align="center" style="padding: 24px 30px; background-color: #0d1525; border-top: 1px solid #1e293b; color: #64748b; font-size: 13px; line-height: 1.5;">
                            <p style="margin: 0 0 6px 0;">
                                Has recibido este mensaje porque solicitaste plaza en la beta privada de <strong>Alfonso AI Konta</strong>.
                            </p>
                            <p style="margin: 0;">
                                © 2026 Alfonso AI Konta • <a href="mailto:hola@alfonsoaikonta.com" style="color: #94a3b8; text-decoration: none;">hola@alfonsoaikonta.com</a> • <a href="https://www.alfonsoaikonta.com" style="color: #94a3b8; text-decoration: none;">www.alfonsoaikonta.com</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`.trim();

    return {
        subject,
        from,
        html,
        text
    };
}
