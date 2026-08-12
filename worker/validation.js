const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_COMPANY_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 2000;

function isNonEmptyString(value, maxLength) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= maxLength
    );
}

function isValidEmail(email) {
    if (typeof email !== "string") {
        return false;
    }

    const normalizedEmail = email.trim();

    if (normalizedEmail.length === 0) {
        return false;
    }

    if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

export function validateLead(payload) {
    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {
        return {
            valid: false
        };
    }

    const {
        name,
        email,
        company,
        message,
        website
    } = payload;

    /*
     * Honeypot anti-bot.
     *
     * Este campo no debe ser rellenado por un usuario normal.
     * Si contiene cualquier valor, rechazamos la solicitud.
     */
    if (
        website !== undefined &&
        website !== null &&
        typeof website === "string" &&
        website.trim().length > 0
    ) {
        return {
            valid: false,
            reason: "HONEYPOT"
        };
    }

    if (!isNonEmptyString(name, MAX_NAME_LENGTH)) {
        return {
            valid: false
        };
    }

    if (!isValidEmail(email)) {
        return {
            valid: false
        };
    }

    if (
        company !== undefined &&
        company !== null &&
        !isNonEmptyString(
            company,
            MAX_COMPANY_LENGTH
        )
    ) {
        return {
            valid: false
        };
    }

    if (
        message !== undefined &&
        message !== null &&
        !isNonEmptyString(
            message,
            MAX_MESSAGE_LENGTH
        )
    ) {
        return {
            valid: false
        };
    }

    return {
        valid: true,
        data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            company:
                typeof company === "string"
                    ? company.trim()
                    : "",
            message:
                typeof message === "string"
                    ? message.trim()
                    : ""
        }
    };
}