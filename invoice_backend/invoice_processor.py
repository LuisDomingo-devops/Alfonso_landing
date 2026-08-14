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

from tax_engine import TaxEngine
from llm_client import GeminiClient


NIF_PATTERN = re.compile(
    r"\b[A-HJ-NP-SUVWXY\d]"
    r"\d{7}"
    r"[A-Z\d]\b",
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


def extract_pdf_text(
    path: Path
) -> tuple[str, str]:

    text = ""

    if pdfplumber is not None:

        try:
            with pdfplumber.open(path) as pdf:

                pages = []

                for page in pdf.pages:

                    page_text = (
                        page.extract_text()
                    )

                    if page_text:
                        pages.append(
                            page_text
                        )

                text = "\n".join(
                    pages
                ).strip()

        except Exception:
            text = ""

    if text:
        return text, "pdf-text"


    if pypdf is not None:

        try:
            reader = pypdf.PdfReader(
                str(path)
            )

            pages = []

            for page in reader.pages:

                page_text = (
                    page.extract_text()
                )

                if page_text:
                    pages.append(
                        page_text
                    )

            text = "\n".join(
                pages
            ).strip()

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

        from pdf2image import (
            convert_from_path
        )

        images = convert_from_path(
            str(path),
            dpi=250,
        )

        pages = []

        for image in images:

            page_text = (
                pytesseract.image_to_string(
                    image,
                    lang="spa+eng",
                )
            )

            if page_text:
                pages.append(
                    page_text
                )

        text = "\n".join(
            pages
        ).strip()

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
    path: Path
) -> tuple[str, str]:

    if pytesseract is None:

        raise ValueError(
            "OCR no está disponible."
        )

    try:

        image = Image.open(path)

        text = (
            pytesseract.image_to_string(
                image,
                lang="spa+eng",
            )
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
    path: Path
) -> tuple[str, str]:

    extension = (
        path.suffix.lower()
    )

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
    text: str
) -> str:

    result = text

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

    return result


def build_llm_invoice_prompt(
    text: str,
) -> str:

    return f"""
Eres Alfonso, un asistente especializado
en administración, fiscalidad y contabilidad
para autónomos y pequeñas empresas en España.

Has recibido el contenido anonimizado de un
documento que puede ser una factura.

Debes entender el documento, no limitarte
a buscar números.

Analiza:

- quién emite el documento
- quién lo recibe
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
- si representa un ingreso o un gasto
- tratamiento fiscal
- tratamiento contable
- trimestre fiscal correspondiente

No inventes información.

Si un dato no aparece claramente,
devuelve null.

Devuelve EXCLUSIVAMENTE JSON válido
con esta estructura:

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

DOCUMENTO:

{text}
"""


def build_response_prompt(
    invoice: dict[str, Any],
) -> str:

    return f"""
Eres Alfonso.

Has analizado una factura de un autónomo
o pequeña empresa española.

Debes explicar al usuario qué has entendido
y qué debería hacerse con ese documento.

No inventes datos.

Explica de forma clara y profesional:

1. Qué documento es.
2. Qué operación representa.
3. Cuál es el concepto.
4. Los importes relevantes.
5. Si es ingreso o gasto.
6. Qué tratamiento fiscal corresponde.
7. Cómo se registraría conceptualmente
   en los libros contables.
8. A qué trimestre corresponde.
9. Si existe algún dato que debería revisarse.

No des asesoramiento jurídico absoluto.
Si existe incertidumbre, indícala.

La respuesta debe parecer una explicación
de Alfonso a un cliente, no un informe técnico.

DATOS EXTRAÍDOS:

{invoice}
"""


def process_invoice(
    path: Path,
    filename: str,
) -> dict[str, Any]:

    raw_text, extraction_method = (
        extract_text(path)
    )

    if not raw_text.strip():

        raise ValueError(
            "No se ha podido extraer "
            "contenido del documento."
        )

    anonymized_text = (
        anonymize_text(raw_text)
    )

    if not anonymized_text.strip():

        raise ValueError(
            "No se ha obtenido contenido "
            "procesable."
        )

    llm = GeminiClient()

    invoice_data = (
        llm.analyse_invoice(
            anonymized_text
        )
    )

    if not isinstance(
        invoice_data,
        dict,
    ):

        raise ValueError(
            "Gemini no ha devuelto "
            "datos estructurados válidos."
        )

    validated = (
        TaxEngine.validate_invoice(
            invoice_data
        )
    )

    explanation = (
        llm.generate_explanation(
            validated
        )
    )

    return {
        "success": True,

        "filename": filename,

        "processing": {
            "extraction": extraction_method,
            "anonymized": True,
            "llm": "gemini-3.1-flash-lite",
            "engine": "Alfonso Invoice Demo",
        },

        "invoice": validated,

        "explanation": explanation,
    }