const SESSION_COOKIE = "alfonso_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

const MAX_LOGIN_BODY_SIZE = 4096;

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8",
                "Cache-Control": "no-store",
                ...headers
            }
        }
    );
}

function getCookie(request, name) {
    const cookieHeader =
        request.headers.get("Cookie");

    if (!cookieHeader) {
        return null;
    }

    for (const cookie of cookieHeader.split(";")) {
        const separator =
            cookie.indexOf("=");

        if (separator === -1) {
            continue;
        }

        const key =
            cookie
                .slice(0, separator)
                .trim();

        if (key !== name) {
            continue;
        }

        return cookie
            .slice(separator + 1)
            .trim();
    }

    return null;
}

function createSessionCookie(
    token,
    maxAge
) {
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
    const data =
        new TextEncoder().encode(value);

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

async function createToken() {
    const bytes =
        new Uint8Array(32);

    crypto.getRandomValues(bytes);

    return Array.from(bytes)
        .map(
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0")
        )
        .join("");
}

function constantTimeEqual(
    first,
    second
) {
    if (
        typeof first !== "string" ||
        typeof second !== "string"
    ) {
        return false;
    }

    if (first.length !== second.length) {
        return false;
    }

    let difference = 0;

    for (
        let index = 0;
        index < first.length;
        index++
    ) {
        difference |=
            first.charCodeAt(index) ^
            second.charCodeAt(index);
    }

    return difference === 0;
}

async function verifyPassword(
    password,
    expectedPassword
) {
    if (
        typeof password !== "string" ||
        typeof expectedPassword !== "string"
    ) {
        return false;
    }

    const suppliedHash =
        await sha256(password);

    const expectedHash =
        await sha256(expectedPassword);

    return constantTimeEqual(
        suppliedHash,
        expectedHash
    );
}

function unauthorized() {
    return jsonResponse(
        {
            success: false,
            error: {
                code: "UNAUTHORIZED",
                message:
                    "Authentication required."
            }
        },
        401
    );
}

export async function authenticateAdmin(
    request,
    env
) {
    const token =
        getCookie(
            request,
            SESSION_COOKIE
        );

    if (!token) {
        return false;
    }

    const tokenHash =
        await sha256(token);

    const now =
        Math.floor(
            Date.now() / 1000
        );

    try {
        const session =
            await env.alfonso_leads
                .prepare(
                    `
                    SELECT id
                    FROM admin_sessions
                    WHERE token_hash = ?
                    AND expires_at > ?
                    LIMIT 1
                    `
                )
                .bind(
                    tokenHash,
                    now
                )
                .first();

        return Boolean(session);
    } catch (error) {
        console.error(
            "Admin authentication error:",
            error
        );

        return false;
    }
}

export async function handleAdminLogin(
    request,
    env
) {
    if (request.method !== "POST") {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "METHOD_NOT_ALLOWED",
                    message:
                        "Method not allowed."
                }
            },
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
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "UNSUPPORTED_MEDIA_TYPE",
                    message:
                        "Content-Type must be application/json."
                }
            },
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
            MAX_LOGIN_BODY_SIZE
    ) {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "PAYLOAD_TOO_LARGE",
                    message:
                        "Request body is too large."
                }
            },
            413
        );
    }

    let payload;

    try {
        const rawBody =
            await request.text();

        if (
            rawBody.length >
            MAX_LOGIN_BODY_SIZE
        ) {
            return jsonResponse(
                {
                    success: false,
                    error: {
                        code:
                            "PAYLOAD_TOO_LARGE",
                        message:
                            "Request body is too large."
                    }
                },
                413
            );
        }

        payload =
            JSON.parse(rawBody);
    } catch {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "INVALID_JSON",
                    message:
                        "Request body must contain valid JSON."
                }
            },
            400
        );
    }

    const password =
        payload?.password;

    const valid =
        await verifyPassword(
            password,
            env.ADMIN_PASSWORD
        );

    if (!valid) {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "INVALID_CREDENTIALS",
                    message:
                        "Invalid credentials."
                }
            },
            401
        );
    }

    const token =
        await createToken();

    const tokenHash =
        await sha256(token);

    const now =
        Math.floor(
            Date.now() / 1000
        );

    const expiresAt =
        now + SESSION_TTL_SECONDS;

    try {
        await env.alfonso_leads
            .prepare(
                `
                DELETE FROM admin_sessions
                WHERE expires_at <= ?
                `
            )
            .bind(now)
            .run();

        await env.alfonso_leads
            .prepare(
                `
                INSERT INTO admin_sessions (
                    token_hash,
                    created_at,
                    expires_at
                )
                VALUES (?, ?, ?)
                `
            )
            .bind(
                tokenHash,
                now,
                expiresAt
            )
            .run();
    } catch (error) {
        console.error(
            "Admin session creation error:",
            error
        );

        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "SESSION_ERROR",
                    message:
                        "Unable to create session."
                }
            },
            500
        );
    }

    return jsonResponse(
        {
            success: true,
            data: {
                authenticated: true
            }
        },
        200,
        {
            "Set-Cookie":
                createSessionCookie(
                    token,
                    SESSION_TTL_SECONDS
                )
        }
    );
}

export async function handleAdminLogout(
    request,
    env
) {
    if (request.method !== "POST") {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "METHOD_NOT_ALLOWED",
                    message:
                        "Method not allowed."
                }
            },
            405,
            {
                Allow: "POST"
            }
        );
    }

    const token =
        getCookie(
            request,
            SESSION_COOKIE
        );

    if (token) {
        const tokenHash =
            await sha256(token);

        try {
            await env.alfonso_leads
                .prepare(
                    `
                    DELETE FROM admin_sessions
                    WHERE token_hash = ?
                    `
                )
                .bind(tokenHash)
                .run();
        } catch (error) {
            console.error(
                "Admin logout error:",
                error
            );
        }
    }

    return jsonResponse(
        {
            success: true,
            data: {
                authenticated: false
            }
        },
        200,
        {
            "Set-Cookie":
                createSessionCookie(
                    "",
                    0
                )
        }
    );
}

export async function handleAdminMe(
    request,
    env
) {
    if (request.method !== "GET") {
        return jsonResponse(
            {
                success: false,
                error: {
                    code:
                        "METHOD_NOT_ALLOWED",
                    message:
                        "Method not allowed."
                }
            },
            405,
            {
                Allow: "GET"
            }
        );
    }

    const authenticated =
        await authenticateAdmin(
            request,
            env
        );

    if (!authenticated) {
        return unauthorized();
    }

    return jsonResponse({
        success: true,
        data: {
            authenticated: true
        }
    });
}

export { unauthorized };