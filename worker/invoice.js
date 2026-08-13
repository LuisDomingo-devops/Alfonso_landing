const NIF_REGEX =
    /\b[A-HJ-NP-SUVWXY\d]\d{7}[A-Z\d]\b/gi;

const DATE_REGEX =
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;

const DATE_ISO_REGEX =
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/;

const MONEY_REGEX =
    /\b\d+(?:[.,]\d{2})?\b/g;

function parseNumber(value) {
    let text = String(value)
        .replace(/€/g, "")
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .trim();

    if (text.includes(",") && text.includes(".")) {
        text = text
            .replace(/\./g, "")
            .replace(",", ".");
    } else if (text.includes(",")) {
        text = text.replace(",", ".");
    }

    const number = Number.parseFloat(text);

    return Number.isFinite(number)
        ? number
        : 0;
}

function resolveDates(text) {
    let date = null;

    const isoMatch =
        text.match(DATE_ISO_REGEX);

    if (isoMatch) {
        const [, yyyy, mm, dd] =
            isoMatch;

        date =
            `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    } else {
        const standardMatch =
            text.match(DATE_REGEX);

        if (standardMatch) {
            let [, dd, mm, yyyy] =
                standardMatch;

            if (yyyy.length === 2) {
                yyyy = `20${yyyy}`;
            }

            date =
                `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        }
    }

    const resolved =
        date
            ? new Date(`${date}T00:00:00`)
            : new Date();

    if (
        Number.isNaN(
            resolved.getTime()
        )
    ) {
        const now = new Date();

        return {
            date: now.toISOString().slice(0, 10),
            year: now.getFullYear(),
            quarter:
                Math.floor(
                    now.getMonth() / 3
                ) + 1
        };
    }

    return {
        date,
        year: resolved.getFullYear(),
        quarter:
            Math.floor(
                resolved.getMonth() / 3
            ) + 1
    };
}

function resolveRates(text) {
    let ivaRate = 21;
    let irpfRate = 0;

    const ivaMatch =
        text.match(
            /(?:iva|i\.v\.a\.)[^0-9%]*?(\d+)\s*%/i
        );

    if (ivaMatch) {
        ivaRate =
            Number.parseFloat(
                ivaMatch[1]
            );
    }

    const irpfMatch =
        text.match(
            /(?:irpf|i\.r\.p\.f\.|retención)[^0-9%-]*?(-?\d+)\s*%/i
        );

    if (irpfMatch) {
        irpfRate =
            Math.abs(
                Number.parseFloat(
                    irpfMatch[1]
                )
            );
    }

    return {
        ivaRate,
        irpfRate
    };
}

function recalculateAndValidate(
    base,
    ivaRate,
    irpfRate,
    total
) {
    let iva = 0;
    let irpf = 0;

    if (
        base > 0 &&
        total === 0
    ) {
        iva =
            Math.round(
                base *
                (ivaRate / 100) *
                100
            ) / 100;

        irpf =
            Math.round(
                base *
                (irpfRate / 100) *
                100
            ) / 100;

        total =
            Math.round(
                (base + iva - irpf) *
                100
            ) / 100;
    } else if (
        total > 0 &&
        base > 0
    ) {
        iva =
            Math.round(
                base *
                (ivaRate / 100) *
                100
            ) / 100;

        irpf =
            Math.round(
                base *
                (irpfRate / 100) *
                100
            ) / 100;
    } else if (
        total > 0 &&
        base === 0
    ) {
        const divisor =
            1 +
            (ivaRate / 100) -
            (irpfRate / 100);

        base =
            Math.round(
                (total / divisor) *
                100
            ) / 100;

        iva =
            Math.round(
                base *
                (ivaRate / 100) *
                100
            ) / 100;

        irpf =
            Math.round(
                base *
                (irpfRate / 100) *
                100
            ) / 100;
    }

    const expectedTotal =
        Math.round(
            (base + iva - irpf) *
            100
        ) / 100;

    if (
        Math.abs(
            total - expectedTotal
        ) > 0.05
    ) {
        total = expectedTotal;
    }

    return {
        base,
        iva,
        irpf,
        total
    };
}

function extractFinancials(
    text,
    ivaRate,
    irpfRate
) {
    let base = 0;
    let total = 0;

    const lower =
        text.toLowerCase();

    const totalMatches =
        [
            ...lower.matchAll(
                /(?:total|importe total|a pagar|total factura)\s*(?:[a-z\s]+)?[\s:]*([0-9.,\s]+(?:€|\b))/gi
            )
        ];

    for (
        let index =
            totalMatches.length - 1;
        index >= 0;
        index--
    ) {
        const value =
            parseNumber(
                totalMatches[index][1]
            );

        if (value > 0) {
            total = value;
            break;
        }
    }

    const baseMatches =
        [
            ...lower.matchAll(
                /(?:base imponible|subtotal|base|neto)[\s:]*([0-9.,\s]+(?:€|\b))/gi
            )
        ];

    for (
        let index =
            baseMatches.length - 1;
        index >= 0;
        index--
    ) {
        const value =
            parseNumber(
                baseMatches[index][1]
            );

        if (value > 0) {
            base = value;
            break;
        }
    }

    if (
        base === 0 &&
        total === 0
    ) {
        const numbers = [];

        for (
            const match of
            text.matchAll(
                /\b\d{1,3}(?:\.\d{3})*(?:,\d{2})\b|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b|\b\d+(?:[.,]\d{2})\b/g
            )
        ) {
            const value =
                parseNumber(
                    match[0]
                );

            if (value > 0) {
                numbers.push(value);
            }
        }

        if (numbers.length) {
            total =
                Math.max(...numbers);

            base =
                Math.round(
                    (
                        total /
                        (1 + ivaRate / 100)
                    ) *
                    100
                ) / 100;
        }
    }

    return recalculateAndValidate(
        base,
        ivaRate,
        irpfRate,
        total
    );
}

function findNames(text) {
    const lines =
        text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean);

    let issuerName =
        "Proveedor identificado";

    let receiverName =
        "Cliente identificado";

    for (
        const line of
        lines.slice(0, 20)
    ) {
        const lower =
            line.toLowerCase();

        if (
            lower.includes("emisor") ||
            lower.includes("proveedor")
        ) {
            const cleaned =
                line
                    .replace(
                        /emisor|proveedor|nif|cif|:/gi,
                        ""
                    )
                    .trim();

            if (
                cleaned.length > 3
            ) {
                issuerName =
                    cleaned;
            }
        }

        if (
            lower.includes("cliente") ||
            lower.includes("receptor") ||
            lower.includes("destinatario")
        ) {
            const cleaned =
                line
                    .replace(
                        /cliente|receptor|destinatario|nif|cif|:/gi,
                        ""
                    )
                    .trim();

            if (
                cleaned.length > 3
            ) {
                receiverName =
                    cleaned;
            }
        }
    }

    return {
        issuerName,
        receiverName
    };
}

function classifyConcept(text) {
    const lower =
        text.toLowerCase();

    const categories = [
        {
            name:
                "Servicios profesionales",
            words: [
                "consultoría",
                "consultoria",
                "asesoría",
                "asesoria",
                "servicios profesionales",
                "honorarios",
                "desarrollo",
                "programación",
                "programacion",
                "diseño",
                "fotografía",
                "fotografia"
            ]
        },
        {
            name:
                "Suministros",
            words: [
                "electricidad",
                "agua",
                "gas",
                "telefonía",
                "telefonia",
                "internet",
                "suministro"
            ]
        },
        {
            name:
                "Software y tecnología",
            words: [
                "software",
                "licencia",
                "hosting",
                "dominio",
                "cloud",
                "saas",
                "suscripción",
                "suscripcion"
            ]
        },
        {
            name:
                "Material y equipamiento",
            words: [
                "material",
                "equipo",
                "ordenador",
                "monitor",
                "impresora",
                "hardware"
            ]
        },
        {
            name:
                "Publicidad y marketing",
            words: [
                "publicidad",
                "marketing",
                "campaña",
                "campana",
                "anuncio"
            ]
        }
    ];

    for (
        const category of
        categories
    ) {
        if (
            category.words.some(
                word =>
                    lower.includes(word)
            )
        ) {
            return category.name;
        }
    }

    return "Concepto no determinado con suficiente confianza";
}

function anonymizeText(text) {
    let anonymized =
        text;

    anonymized =
        anonymized.replace(
            NIF_REGEX,
            "[NIF ANONIMIZADO]"
        );

    anonymized =
        anonymized.replace(
            /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
            "[EMAIL ANONIMIZADO]"
        );

    anonymized =
        anonymized.replace(
            /\b(?:ES)?\d{20,24}\b/g,
            "[IBAN ANONIMIZADO]"
        );

    anonymized =
        anonymized.replace(
            /\b(?:tel(?:éfono)?|telefono|móvil|movil|phone)[\s:.-]*\+?\d[\d\s-]{7,}\b/gi,
            "[TELÉFONO ANONIMIZADO]"
        );

    return anonymized;
}

function extractInvoiceId(text) {
    const match =
        text.match(
            /\b(?:factura(?:\s+(?:número|nº|num))?|número|nº|num)[\s#:]*([A-Za-z0-9-]*\d[A-Za-z0-9-]*)/i
        );

    if (match) {
        return match[1]
            .toUpperCase()
            .trim();
    }

    return "FACTURA-DEMO";
}

export function processInvoiceText(
    text
) {
    if (
        !text ||
        text.trim().length < 10
    ) {
        throw new Error(
            "No se ha podido obtener suficiente texto de la factura."
        );
    }

    const anonymizedText =
        anonymizeText(text);

    const nifs =
        [
            ...text.matchAll(
                NIF_REGEX
            )
        ]
            .map(
                match =>
                    match[0]
                        .toUpperCase()
            )
            .filter(
                (value, index, array) =>
                    array.indexOf(value) ===
                    index
            );

    const {
        date,
        year,
        quarter
    } =
        resolveDates(text);

    const {
        ivaRate,
        irpfRate
    } =
        resolveRates(
            text
        );

    const {
        base,
        iva,
        irpf,
        total
    } =
        extractFinancials(
            text,
            ivaRate,
            irpfRate
        );

    const {
        issuerName,
        receiverName
    } =
        findNames(
            anonymizedText
        );

    const concept =
        classifyConcept(
            text
        );

    const category =
        "expense";

    const accountingExplanation =
        `Alfonso identifica esta operación como "${concept}". ` +
        `La base imponible de ${base.toFixed(2)} € ` +
        `se corresponde con el gasto registrado, ` +
        `mientras que ${iva.toFixed(2)} € corresponden al IVA soportado. ` +
        (
            irpf > 0
                ? `También identifica una retención de IRPF de ${irpf.toFixed(2)} €. `
                : ""
        ) +
        `El total de la factura asciende a ${total.toFixed(2)} €. ` +
        `La operación corresponde al trimestre ${quarter} de ${year}.`;

    return {
        success: true,

        invoice: {
            invoice_id:
                extractInvoiceId(
                    text
                ),

            date,

            issuer:
                issuerName,

            receiver:
                receiverName,

            issuer_nif:
                nifs[0] ||
                "[NIF ANONIMIZADO]",

            receiver_nif:
                nifs[1] ||
                "[NIF ANONIMIZADO]",

            base_imponible:
                base,

            iva_rate:
                ivaRate,

            iva_amount:
                iva,

            irpf_rate:
                irpfRate,

            irpf_amount:
                irpf,

            total_amount:
                total,

            category,

            concept,

            quarter,

            year
        },

        accounting: {
            concept,

            category:
                "Gasto",

            explanation:
                accountingExplanation
        },

        anonymized: true,

        anonymized_text:
            anonymizedText
    };
}