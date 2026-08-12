import {
    authenticateAdmin,
    unauthorized
} from "./admin.js";


const ALLOWED_STATUSES = new Set([
    "new",
    "contacted",
    "qualified",
    "converted",
    "discarded"
]);


function jsonResponse(
    data,
    status = 200,
    headers = {}
) {
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


function errorResponse(
    code,
    message,
    status = 400
) {
    return jsonResponse(
        {
            success: false,
            error: {
                code,
                message
            }
        },
        status
    );
}


function successResponse(
    data,
    status = 200
) {
    return jsonResponse(
        {
            success: true,
            data
        },
        status
    );
}


async function parseJsonBody(request) {
    const contentType =
        request.headers.get("Content-Type");


    if (
        !contentType ||
        !contentType
            .toLowerCase()
            .startsWith("application/json")
    ) {
        return {
            valid: false,
            response: errorResponse(
                "UNSUPPORTED_MEDIA_TYPE",
                "Content-Type must be application/json.",
                415
            )
        };
    }


    let body;


    try {
        body = await request.json();
    } catch {
        return {
            valid: false,
            response: errorResponse(
                "INVALID_JSON",
                "Request body must contain valid JSON.",
                400
            )
        };
    }


    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
    ) {
        return {
            valid: false,
            response: errorResponse(
                "VALIDATION_ERROR",
                "Invalid request body.",
                400
            )
        };
    }


    return {
        valid: true,
        body
    };
}


async function requireAdmin(
    request,
    env
) {
    const authenticated =
        await authenticateAdmin(
            request,
            env
        );


    if (!authenticated) {
        return unauthorized();
    }


    return null;
}


function normalizeEmail(email) {
    return email
        .trim()
        .toLowerCase();
}


async function emailAlreadyExists(
    env,
    email
) {
    const existing =
        await env.alfonso_leads
            .prepare(
                `
                SELECT id
                FROM leads
                WHERE LOWER(TRIM(email)) = ?
                LIMIT 1
                `
            )
            .bind(
                normalizeEmail(email)
            )
            .first();


    return existing || null;
}


function isUniqueConstraintError(error) {
    const message =
        String(
            error?.message || ""
        ).toLowerCase();


    return (
        message.includes("unique") ||
        message.includes("constraint")
    );
}


export async function handleAdminLeadsList(
    request,
    env
) {
    if (request.method === "GET") {
        return listLeads(
            request,
            env
        );
    }


    if (request.method === "POST") {
        return createLead(
            request,
            env
        );
    }


    return errorResponse(
        "METHOD_NOT_ALLOWED",
        "Method not allowed.",
        405
    );
}


async function listLeads(
    request,
    env
) {
    const authError =
        await requireAdmin(
            request,
            env
        );


    if (authError) {
        return authError;
    }


    const url =
        new URL(request.url);


    const status =
        url.searchParams.get("status");


    const search =
        url.searchParams.get("search");


    const pageParam =
        Number(
            url.searchParams.get("page") || "1"
        );


    const limitParam =
        Number(
            url.searchParams.get("limit") || "25"
        );


    const page =
        Number.isInteger(pageParam) &&
        pageParam > 0
            ? pageParam
            : 1;


    const limit =
        Number.isInteger(limitParam) &&
        limitParam >= 1 &&
        limitParam <= 100
            ? limitParam
            : 25;


    const offset =
        (page - 1) * limit;


    if (
        status &&
        !ALLOWED_STATUSES.has(status)
    ) {
        return errorResponse(
            "INVALID_STATUS",
            "Invalid lead status.",
            400
        );
    }


    const conditions = [];
    const params = [];


    if (status) {
        conditions.push(
            "status = ?"
        );


        params.push(status);
    }


    if (search) {
        conditions.push(
            `(
                name LIKE ?
                OR email LIKE ?
                OR company LIKE ?
            )`
        );


        const pattern =
            `%${search}%`;


        params.push(
            pattern,
            pattern,
            pattern
        );
    }


    const where =
        conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";


    try {
        const countResult =
            await env.alfonso_leads
                .prepare(
                    `
                    SELECT COUNT(*) AS total
                    FROM leads
                    ${where}
                    `
                )
                .bind(...params)
                .first();


        const total =
            Number(
                countResult?.total || 0
            );


        const leads =
            await env.alfonso_leads
                .prepare(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        company,
                        message,
                        source,
                        created_at,
                        status,
                        notes,
                        contacted_at,
                        updated_at
                    FROM leads
                    ${where}
                    ORDER BY
                        created_at DESC,
                        id DESC
                    LIMIT ?
                    OFFSET ?
                    `
                )
                .bind(
                    ...params,
                    limit,
                    offset
                )
                .all();


        return successResponse({
            leads:
                leads.results || [],
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(
                        total / limit
                    )
            }
        });
    } catch (error) {
        console.error(
            "Admin leads list error:",
            error
        );


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to retrieve leads.",
            500
        );
    }
}


async function createLead(
    request,
    env
) {
    const authError =
        await requireAdmin(
            request,
            env
        );


    if (authError) {
        return authError;
    }


    const parsed =
        await parseJsonBody(
            request
        );


    if (!parsed.valid) {
        return parsed.response;
    }


    const {
        name,
        email,
        company,
        message,
        source,
        status,
        notes,
        contacted_at
    } = parsed.body;


    if (
        typeof name !== "string" ||
        !name.trim()
    ) {
        return errorResponse(
            "INVALID_NAME",
            "Name is required.",
            400
        );
    }


    const normalizedName =
        name.trim();


    if (
        normalizedName.length > 200
    ) {
        return errorResponse(
            "INVALID_NAME",
            "Name is too long.",
            400
        );
    }


    if (
        typeof email !== "string" ||
        !email.trim()
    ) {
        return errorResponse(
            "INVALID_EMAIL",
            "Email is required.",
            400
        );
    }


    const normalizedEmail =
        normalizeEmail(email);


    if (
        normalizedEmail.length > 320
    ) {
        return errorResponse(
            "INVALID_EMAIL",
            "Email is too long.",
            400
        );
    }


    const normalizedStatus =
        status === undefined
            ? "new"
            : status;


    if (
        typeof normalizedStatus !== "string" ||
        !ALLOWED_STATUSES.has(
            normalizedStatus
        )
    ) {
        return errorResponse(
            "INVALID_STATUS",
            "Invalid lead status.",
            400
        );
    }


    if (
        company !== undefined &&
        company !== null &&
        typeof company !== "string"
    ) {
        return errorResponse(
            "INVALID_COMPANY",
            "Company must be a string.",
            400
        );
    }


    if (
        message !== undefined &&
        message !== null &&
        typeof message !== "string"
    ) {
        return errorResponse(
            "INVALID_MESSAGE",
            "Message must be a string.",
            400
        );
    }


    if (
        notes !== undefined &&
        notes !== null &&
        (
            typeof notes !== "string" ||
            notes.length > 5000
        )
    ) {
        return errorResponse(
            "INVALID_NOTES",
            "Notes must be a string with a maximum length of 5000 characters.",
            400
        );
    }


    if (
        contacted_at !== undefined &&
        contacted_at !== null &&
        typeof contacted_at !== "string"
    ) {
        return errorResponse(
            "INVALID_CONTACTED_AT",
            "contacted_at must be a string or null.",
            400
        );
    }


    const normalizedCompany =
        typeof company === "string"
            ? company.trim()
            : "";


    const normalizedMessage =
        typeof message === "string"
            ? message.trim()
            : "";


    const normalizedNotes =
        typeof notes === "string"
            ? notes.trim()
            : "";


    /*
     * First check:
     * verify whether the normalized email already
     * exists before attempting the INSERT.
     */
    try {
        const existingLead =
            await emailAlreadyExists(
                env,
                normalizedEmail
            );


        if (existingLead) {
            return errorResponse(
                "DUPLICATE_EMAIL",
                "A lead with this email already exists.",
                409
            );
        }
    } catch (error) {
        console.error(
            "Admin lead duplicate check error:",
            error
        );


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to verify whether the email already exists.",
            500
        );
    }


    const createdAt =
        new Date().toISOString();


    try {
        const result =
            await env.alfonso_leads
                .prepare(
                    `
                    INSERT INTO leads (
                        name,
                        email,
                        company,
                        message,
                        source,
                        created_at,
                        status,
                        notes,
                        contacted_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `
                )
                .bind(
                    normalizedName,
                    normalizedEmail,
                    normalizedCompany,
                    normalizedMessage,
                    typeof source === "string" &&
                        source.trim()
                        ? source.trim()
                        : "admin",
                    createdAt,
                    normalizedStatus,
                    normalizedNotes,
                    contacted_at ?? null,
                    createdAt
                )
                .run();


        const id =
            result.meta?.last_row_id;


        if (
            id === undefined ||
            id === null
        ) {
            console.error(
                "Admin lead creation returned no ID:",
                result
            );


            return errorResponse(
                "DATABASE_ERROR",
                "Lead was created but its ID could not be determined.",
                500
            );
        }


        return getLead(
            request,
            env,
            Number(id)
        );
    } catch (error) {
        console.error(
            "Admin lead creation error:",
            error
        );


        /*
         * The database has a UNIQUE index on email.
         *
         * A concurrent request could insert the same
         * email between our initial SELECT and INSERT.
         *
         * Therefore, only report DUPLICATE_EMAIL if:
         *
         * 1. The INSERT produced a unique/constraint error
         * 2. The email actually exists in the database
         */
        if (
            isUniqueConstraintError(error)
        ) {
            try {
                const existingLead =
                    await emailAlreadyExists(
                        env,
                        normalizedEmail
                    );


                if (existingLead) {
                    return errorResponse(
                        "DUPLICATE_EMAIL",
                        "A lead with this email already exists.",
                        409
                    );
                }
            } catch (duplicateCheckError) {
                console.error(
                    "Admin lead post-insert duplicate check error:",
                    duplicateCheckError
                );
            }
        }


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to create lead.",
            500
        );
    }
}


export async function handleAdminLeadDetail(
    request,
    env,
    id
) {
    if (
        request.method !== "GET" &&
        request.method !== "PATCH" &&
        request.method !== "DELETE"
    ) {
        return errorResponse(
            "METHOD_NOT_ALLOWED",
            "Method not allowed.",
            405
        );
    }


    const authError =
        await requireAdmin(
            request,
            env
        );


    if (authError) {
        return authError;
    }


    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {
        return errorResponse(
            "INVALID_ID",
            "Invalid lead ID.",
            400
        );
    }


    if (
        request.method === "GET"
    ) {
        return getLead(
            request,
            env,
            id
        );
    }


    if (
        request.method === "PATCH"
    ) {
        return updateLead(
            request,
            env,
            id
        );
    }


    return deleteLead(
        request,
        env,
        id
    );
}


async function getLead(
    request,
    env,
    id
) {
    try {
        const lead =
            await env.alfonso_leads
                .prepare(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        company,
                        message,
                        source,
                        created_at,
                        status,
                        notes,
                        contacted_at,
                        updated_at
                    FROM leads
                    WHERE id = ?
                    LIMIT 1
                    `
                )
                .bind(id)
                .first();


        if (!lead) {
            return errorResponse(
                "LEAD_NOT_FOUND",
                "Lead not found.",
                404
            );
        }


        return successResponse(
            lead
        );
    } catch (error) {
        console.error(
            "Admin lead detail error:",
            error
        );


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to retrieve lead.",
            500
        );
    }
}


async function updateLead(
    request,
    env,
    id
) {
    const parsed =
        await parseJsonBody(
            request
        );


    if (!parsed.valid) {
        return parsed.response;
    }


    const {
        status,
        notes,
        contacted_at
    } = parsed.body;


    if (
        status === undefined &&
        notes === undefined &&
        contacted_at === undefined
    ) {
        return errorResponse(
            "NO_FIELDS",
            "No fields were provided for update.",
            400
        );
    }


    if (
        status !== undefined &&
        (
            typeof status !== "string" ||
            !ALLOWED_STATUSES.has(
                status
            )
        )
    ) {
        return errorResponse(
            "INVALID_STATUS",
            "Invalid lead status.",
            400
        );
    }


    if (
        notes !== undefined &&
        (
            typeof notes !== "string" ||
            notes.length > 5000
        )
    ) {
        return errorResponse(
            "INVALID_NOTES",
            "Notes must be a string with a maximum length of 5000 characters.",
            400
        );
    }


    if (
        contacted_at !== undefined &&
        contacted_at !== null &&
        typeof contacted_at !== "string"
    ) {
        return errorResponse(
            "INVALID_CONTACTED_AT",
            "contacted_at must be a string or null.",
            400
        );
    }


    const fields = [];
    const values = [];


    if (
        status !== undefined
    ) {
        fields.push(
            "status = ?"
        );


        values.push(
            status
        );
    }


    if (
        notes !== undefined
    ) {
        fields.push(
            "notes = ?"
        );


        values.push(
            notes.trim()
        );
    }


    if (
        contacted_at !== undefined
    ) {
        fields.push(
            "contacted_at = ?"
        );


        values.push(
            contacted_at
        );
    }


    fields.push(
        "updated_at = ?"
    );


    values.push(
        new Date().toISOString()
    );


    values.push(
        id
    );


    try {
        const result =
            await env.alfonso_leads
                .prepare(
                    `
                    UPDATE leads
                    SET ${fields.join(", ")}
                    WHERE id = ?
                    `
                )
                .bind(...values)
                .run();


        if (
            !result.meta ||
            result.meta.changes === 0
        ) {
            return errorResponse(
                "LEAD_NOT_FOUND",
                "Lead not found.",
                404
            );
        }


        return getLead(
            request,
            env,
            id
        );
    } catch (error) {
        console.error(
            "Admin lead update error:",
            error
        );


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to update lead.",
            500
        );
    }
}


async function deleteLead(
    request,
    env,
    id
) {
    try {
        const result =
            await env.alfonso_leads
                .prepare(
                    `
                    DELETE FROM leads
                    WHERE id = ?
                    `
                )
                .bind(id)
                .run();


        if (
            !result.meta ||
            result.meta.changes === 0
        ) {
            return errorResponse(
                "LEAD_NOT_FOUND",
                "Lead not found.",
                404
            );
        }


        return successResponse({
            deleted: true,
            id
        });
    } catch (error) {
        console.error(
            "Admin lead delete error:",
            error
        );


        return errorResponse(
            "DATABASE_ERROR",
            "Unable to delete lead.",
            500
        );
    }
}