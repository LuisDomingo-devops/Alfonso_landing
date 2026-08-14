import re
from pathlib import Path
from typing import Any

from PIL import Image

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

from llm_client import GeminiClient
from tax_engine import TaxEngine


NIF_PATTERN = re.compile(
    r"\b[A-HJ-NP-SUVWXY\d]"
    r"\d{7}"
    r"[A-Z\d]\b",
    re.IGNORECASE,
)

DNI_PATTERN = re.compile(
    r"\b\d{8}[A-Z]\b",
    re.IGNORECASE,
)

EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9._%+-]+"
    r"@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

IBAN_PATTERN = re.compile(
    r"\b[A-Z]{2}\d{2}"
    r"[A-Z0-9]{11,30}\b",
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
    r"(?<!\d)\d{5}(?!\d)"
)

ADDRESS_LABEL_PATTERN = re.compile(
    r"^\s*"
    r"(dirección|direccion|domicilio|"
    r"domicilio fiscal|calle|avenida|"
    r"avda\.?|c\/|cp|código postal|"
    r"codigo postal)"
    r"\s*[:\-].*$",
    re.IGNORECASE,
)

PERSON_LABEL_PATTERN = re.compile(
    r"^\s*"
    r"(cliente|titular|contacto|"
    r"persona de contacto|"
    r"nombre|razón social|razon social|"
    r"emisor|receptor|proveedor|"
    r"destinatario)"
    r"\s*[:\-].*$",
    re.IGNORECASE,
)


def extract_pdf_text(
    path: Path,
) -> tuple[str, str]:

    text = ""

    if pdfplumber is not None:

        try:
            with pdfplumber.open(path) as pdf:

                pages = []

                for page in pdf.pages:

                    page_text = page.extract_text()

                    if page_text:
                        pages.append(page_text)

                text = "\n".join(pages).strip()

        except Exception:
            text = ""

    if text:
        return text, "pdf-text"

    if pypdf is not None:

        try:
            reader = pypdf.PdfReader(str(path))

            pages = []

            for page in reader.pages:

                page_text = page.extract_text()

                if page_text:
                    pages.append(page_text)

            text = "\n".join(pages).strip()

        except Exception:
            text = ""

    if text:
        return text, "pdf-text"

    if pytesseract is None:

        raise ValueError(
            "El PDF no contiene texto "
            "extraíble y OCR no está disponible."
        )

    try:

        from pdf2image import convert_from_path

        images = convert_from_path(
            str(path),
            dpi=250,
        )

        pages = []

        for image in images:

            page_text = pytesseract.image_to_string(
                image,
                lang="spa+eng",
            )

            if page_text:
                pages.append(page_text)

        text = "\n".join(pages).strip()

    except Exception as exc:

        raise ValueError(
            "No se ha podido extraer "
            "el contenido del PDF."
        ) from exc

    if not text:

        raise ValueError(
            "No se ha encontrado texto "
            "en el documento."
        )

    return text, "ocr"


def extract_image_text(
    path: Path,
) -> tuple[str, str]:

    if pytesseract is None:

        raise ValueError(
            "OCR no está disponible."
        )

    try:

        image = Image.open(path)

        text = pytesseract.image_to_string(
            image,
            lang="spa+eng",
        ).strip()

    except Exception as exc:

        raise ValueError(
            "No se ha podido leer "
            "la imagen."
        ) from exc

    if not text:

        raise ValueError(
            "No se ha encontrado texto "
            "en la imagen."
        )

    return text, "ocr"


def extract_text(
    path: Path,
) -> tuple[str, str]:

    extension = path.suffix.lower()

    if extension == ".pdf":
        return extract_pdf_text(path)

    if extension in {
        ".jpg",
        ".jpeg",
        ".png",
        ".tiff",
        ".bmp",
    }:
        return extract_image_text(path)

    raise ValueError(
        "Formato no soportado."
    )


def anonymize_text(
    text: str,
) -> str:
    """
    Anonimización LOCAL.

    Esta función se ejecuta antes de cualquier
    comunicación con Gemini.

    El documento original nunca se envía a Gemini.
    """

    lines = text.splitlines()

    anonymized_lines = []

    for line in lines:

        stripped = line.strip()

        if not stripped:
            anonymized_lines.append("")
            continue

        if ADDRESS_LABEL_PATTERN.match(stripped):
            anonymized_lines.append(
                "[DIRECCION_ANONIMIZADA]"
            )
            continue

        if PERSON_LABEL_PATTERN.match(stripped):

            label = stripped.split(
                ":",
                1,
            )[0].strip()

            anonymized_lines.append(
                f"{label}: [PERSONA_ANONIMIZADA]"
            )

            continue

        anonymized_lines.append(line)

    result = "\n".join(anonymized_lines)

    result = DNI_PATTERN.sub(
        "[DNI_ANONIMIZADO]",
        result,
    )

    result = NIF_PATTERN.sub(
        "[NIF_ANONIMIZADO]",
        result,
    )

    result = EMAIL_PATTERN.sub(
        "[EMAIL_ANONIMIZADO]",
        result,
    )

    result = IBAN_PATTERN.sub(
        "[IBAN_ANONIMIZADO]",
        result,
    )

    result = PHONE_PATTERN.sub(
        "[TELEFONO_ANONIMIZADO]",
        result,
    )

    result = POSTAL_CODE_PATTERN.sub(
        "[CP_ANONIMIZADO]",
        result,
    )

    return result


def build_llm_invoice_prompt(
    text: str,
) -> str:

    return f"""
Eres Alfonso, un asistente especializado
en administración, fiscalidad y contabilidad
para autónomos y pequeñas empresas en España.

Has recibido información EXTRAÍDA Y
ANONIMIZADA LOCALMENTE de una factura.

IMPORTANTE:

- No recibes la factura original.
- Los datos personales han sido
  anonimizados antes de llegar a ti.
- No intentes reconstruir identidades.
- No inventes información.
- No conviertas marcadores anonimizados
  en nombres reales.

Debes interpretar el contenido disponible.

Analiza:

- tipo de documento
- emisor, si aparece anonimizado
- receptor, si aparece anonimizado
- número de factura
- fecha
- concepto
- productos o servicios
- base imponible
- porcentaje de IVA
- importe de IVA
- porcentaje de IRPF
- importe de IRPF
- total
- naturaleza de la operación
- ingreso o gasto
- categoría
- tratamiento fiscal
- tratamiento contable
- trimestre correspondiente

Si un dato no aparece claramente,
devuelve null.

Devuelve EXCLUSIVAMENTE JSON válido:

{{
  "document_type": "factura",
  "issuer": {{
    "name": null,
    "tax_id": null
  }},
  "receiver": {{
    "name": null,
    "tax_id": null
  }},
  "invoice_number": null,
  "date": null,
  "concept": null,
  "items": [],
  "base_amount": null,
  "vat_rate": null,
  "vat_amount": null,
  "withholding_rate": null,
  "withholding_amount": null,
  "total_amount": null,
  "operation_type": null,
  "category": null,
  "accounting_treatment": null,
  "tax_treatment": null,
  "confidence": 0.0
}}

DOCUMENTO ANONIMIZADO:

{text}
"""


def build_response_prompt(
    invoice: dict[str, Any],
) -> str:

    return f"""
Eres Alfonso.

Has analizado una factura de un autónomo
o pequeña empresa española.

Explica al usuario qué has entendido
y qué debería revisar.

No inventes datos.

Explica:

1. Qué documento es.
2. Qué operación representa.
3. Cuál es el concepto.
4. Los importes relevantes.
5. Si es ingreso o gasto.
6. El tratamiento fiscal detectado.
7. El tratamiento contable propuesto.
8. El trimestre correspondiente.
9. Qué datos deberían revisarse.

Si existe incertidumbre,
indícala claramente.

No presentes una inferencia
como un hecho confirmado.

La respuesta debe parecer una explicación
de Alfonso a un cliente,
no un informe técnico.

DATOS EXTRAÍDOS:

{invoice}
"""


def process_invoice(
    path: Path,
    filename: str,
) -> dict[str, Any]:

    raw_text, extraction_method = extract_text(path)

    if not raw_text.strip():

        raise ValueError(
            "No se ha podido extraer "
            "contenido del documento."
        )

    # =========================================================
    # PASO 1
    # EXTRACCIÓN LOCAL
    # =========================================================

    anonymized_text = anonymize_text(raw_text)

    if not anonymized_text.strip():

        raise ValueError(
            "No se ha obtenido contenido "
            "procesable."
        )

    # =========================================================
    # PASO 2
    # GEMINI RECIBE SOLO TEXTO ANONIMIZADO
    # =========================================================

    llm = GeminiClient()

    invoice_data = llm.analyse_invoice(
        anonymized_text
    )

    if not isinstance(
        invoice_data,
        dict,
    ):

        raise ValueError(
            "Gemini no ha devuelto "
            "datos estructurados válidos."
        )

    # =========================================================
    # PASO 3
    # VALIDACIÓN LOCAL
    # =========================================================

    validated = TaxEngine.validate_invoice(
        invoice_data
    )

    # =========================================================
    # PASO 4
    # EXPLICACIÓN DE ALFONSO
    # =========================================================

    explanation = llm.generate_explanation(
        validated
    )

    return {
        "success": True,

        "filename": filename,

        "processing": {
            "extraction": extraction_method,
            "anonymized": True,
            "raw_invoice_sent_to_gemini": False,
            "llm": "gemini-3.1-flash-lite",
            "engine": "Alfonso Invoice Backend",
        },

        "invoice": validated,

        "explanation": explanation,
    }