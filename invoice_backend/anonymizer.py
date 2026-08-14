import re


NIF_PATTERN = re.compile(
    r"\b[A-HJ-NP-SUVWXY\d]"
    r"\d{7}"
    r"[A-Z\d]\b",
    re.IGNORECASE,
)

NIE_PATTERN = re.compile(
    r"\b[XYZ]\d{7}[A-Z]\b",
    re.IGNORECASE,
)

EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9._%+-]+"
    r"@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

IBAN_PATTERN = re.compile(
    r"\b[A-Z]{2}\d{2}"
    r"(?:[\s-]?[A-Z0-9]){11,34}\b",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:\+34[\s.-]?)?"
    r"(?:[6789]\d{2})"
    r"(?:[\s.-]?\d{3}){2}"
    r"(?!\d)"
)

POSTAL_CODE_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:0[1-9]|[1-4]\d|5[0-2])\d{3}"
    r"(?!\d)"
)

CARD_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:\d[ -]?){13,19}"
    r"(?!\d)"
)

IDENTITY_LABEL_PATTERN = re.compile(
    r"^\s*("
    r"cliente|"
    r"titular|"
    r"nombre\s+y?\s*apellidos?|"
    r"raz[oó]n\s+social|"
    r"empresa|"
    r"emisor|"
    r"receptor|"
    r"destinatario|"
    r"facturado\s+a|"
    r"direcci[oó]n|"
    r"domicilio|"
    r"domicilio\s+fiscal|"
    r"direcci[oó]n\s+fiscal|"
    r"calle|"
    r"avenida|"
    r"avda\.?|"
    r"cif|"
    r"nif|"
    r"nie|"
    r"iban|"
    r"tel[eé]fono|"
    r"m[oó]vil|"
    r"email|"
    r"correo"
    r")\s*[:\-]\s*(.+)$",
    re.IGNORECASE,
)


def _anonymize_identity_lines(text: str) -> str:
    lines = text.splitlines()
    result = []

    for line in lines:
        match = IDENTITY_LABEL_PATTERN.match(line)

        if not match:
            result.append(line)
            continue

        label = match.group(1).strip()

        result.append(
            f"{label}: [DATO_IDENTIFICATIVO_ANONIMIZADO]"
        )

    return "\n".join(result)


def anonymize_text(text: str) -> str:
    if not text:
        return ""

    result = text

    # Primero eliminamos información identificativa
    # asociada a etiquetas típicas de facturas.
    result = _anonymize_identity_lines(result)

    # Identificadores fiscales.
    result = NIE_PATTERN.sub(
        "[NIE_ANONIMIZADO]",
        result,
    )

    result = NIF_PATTERN.sub(
        "[NIF_ANONIMIZADO]",
        result,
    )

    # Información de contacto.
    result = EMAIL_PATTERN.sub(
        "[EMAIL_ANONIMIZADO]",
        result,
    )

    result = PHONE_PATTERN.sub(
        "[TELEFONO_ANONIMIZADO]",
        result,
    )

    # Información bancaria.
    result = IBAN_PATTERN.sub(
        "[IBAN_ANONIMIZADO]",
        result,
    )

    # Códigos postales.
    result = POSTAL_CODE_PATTERN.sub(
        "[CODIGO_POSTAL_ANONIMIZADO]",
        result,
    )

    # Posibles números de tarjeta u otros
    # identificadores numéricos largos.
    result = CARD_PATTERN.sub(
        "[IDENTIFICADOR_NUMERICO_ANONIMIZADO]",
        result,
    )

    return result.strip()