import os
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from PIL import Image

try:
    import pytesseract
except ImportError:
    pytesseract = None

from tax_engine import TaxEngine


NIF_REGEX = re.compile(
    r"\b[A-HJ-NP-SUVWXY\d]\d{7}[A-Z\d]\b",
    re.IGNORECASE
)


def extract_text_from_file(
    file_path: str
) -> str:

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"El archivo no existe: {file_path}"
        )

    ext = path.suffix.lower()

    if ext in {
        ".png",
        ".jpg",
        ".jpeg",
        ".tiff",
        ".bmp",
        ".gif"
    }:

        if pytesseract is None:
            raise RuntimeError(
                "pytesseract no está instalado."
            )

        configure_tesseract()

        with Image.open(path) as image:

            return pytesseract.image_to_string(
                image,
                lang="spa"
            )

    if ext in {
        ".txt",
        ".csv",
        ".json",
        ".xml",
        ".md"
    }:

        return path.read_text(
            encoding="utf-8",
            errors="ignore"
        )

    if ext == ".pdf":

        text = ""

        try:
            import pdfplumber

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

        if not text:

            try:
                import pypdf

                reader = (
                    pypdf.PdfReader(path)
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

        if not text:

            text = extract_pdf_ocr(
                path
            )

        if not text:

            raise RuntimeError(
                "El PDF está escaneado o "
                "vacío y no se ha podido "
                "extraer su contenido."
            )

        return text

    try:
        return path.read_text(
            encoding="utf-8",
            errors="ignore"
        )

    except Exception as exc:

        raise RuntimeError(
            "Formato de archivo no soportado."
        ) from exc


def configure_tesseract():

    if pytesseract is None:
        return

    if os.name != "nt":
        return

    current = getattr(
        pytesseract.pytesseract,
        "tesseract_cmd",
        None
    )

    if current:
        return

    paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for path in paths:

        if os.path.exists(path):

            pytesseract.pytesseract.tesseract_cmd = (
                path
            )

            return


def extract_pdf_ocr(
    path: Path
) -> str:

    if pytesseract is None:
        return ""

    try:
        from pdf2image import (
            convert_from_path
        )

        configure_tesseract()

        images = convert_from_path(
            path
        )

        pages = []

        for image in images:

            page_text = (
                pytesseract.image_to_string(
                    image,
                    lang="spa"
                )
            )

            if page_text:
                pages.append(
                    page_text
                )

        return "\n".join(
            pages
        ).strip()

    except Exception:
        return ""


def anonymize_text(
    text: str
) -> str:

    result = text

    result = NIF_REGEX.sub(
        "[NIF ANONIMIZADO]",
        result
    )

    result = re.sub(
        r"\b[A-Z0-9._%+-]+"
        r"@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        "[EMAIL ANONIMIZADO]",
        result,
        flags=re.IGNORECASE
    )

    result = re.sub(
        r"\bES\d{22}\b",
        "[IBAN ANONIMIZADO]",
        result,
        flags=re.IGNORECASE
    )

    result = re.sub(
        r"\b(?:tel[eé]fono|tel\.|m[oó]vil|"
        r"movil|phone)"
        r"[\s:.-]*"
        r"\+?\d[\d\s-]{7,}",
        "[TELÉFONO ANONIMIZADO]",
        result,
        flags=re.IGNORECASE
    )

    return result


class TaxParserService:

    @staticmethod
    def parse_invoice_text(
        text: str,
        user_nif: str = None
    ) -> Dict[str, Any]:

        user_nif_clean = (
            user_nif.strip().upper()
            if user_nif
            else "ES00000000T"
        )

        nifs = [
            value.upper()
            for value in
            NIF_REGEX.findall(text)
        ]

        unique_nifs = []

        for nif in nifs:

            if nif not in unique_nifs:
                unique_nifs.append(nif)

        issuer_nif = None
        receiver_nif = None

        if len(unique_nifs) >= 2:

            issuer_nif = (
                unique_nifs[0]
            )

            receiver_nif = (
                unique_nifs[1]
            )

        elif len(unique_nifs) == 1:

            found_nif = (
                unique_nifs[0]
            )

            if found_nif == user_nif_clean:

                if re.search(
                    r"(cliente|receptor|destinatario|"
                    r"facturar a)\b.*"
                    + re.escape(found_nif),
                    text,
                    re.IGNORECASE |
                    re.DOTALL
                ):

                    receiver_nif = (
                        found_nif
                    )

                else:

                    issuer_nif = (
                        found_nif
                    )

            else:

                issuer_nif = (
                    found_nif
                )

                receiver_nif = (
                    user_nif_clean
                )

        if (
            not issuer_nif
            and
            not receiver_nif
        ):

            issuer_nif = (
                "ES00000000T"
            )

            receiver_nif = (
                user_nif_clean
            )

        elif not issuer_nif:

            issuer_nif = (
                "ES00000000T"
                if receiver_nif ==
                user_nif_clean
                else user_nif_clean
            )

        elif not receiver_nif:

            receiver_nif = (
                "ES00000000T"
                if issuer_nif ==
                user_nif_clean
                else user_nif_clean
            )

        category = (
            "expense"
            if receiver_nif ==
            user_nif_clean
            else "income"
        )

        date_str, year, quarter = (
            TaxEngine.resolve_dates(
                text
            )
        )

        if category == "expense":

            issuer_name = (
                "Proveedor Desconocido"
            )

            receiver_name = (
                "Titular de la actividad"
            )

        else:

            issuer_name = (
                "Titular de la actividad"
            )

            receiver_name = (
                "Cliente Desconocido"
            )

        lines = [
            line.strip()
            for line in
            text.split("\n")
            if line.strip()
        ]

        for line in lines[:10]:

            lower = line.lower()

            if (
                "emisor" in lower
                or
                "proveedor" in lower
            ):

                clean = re.sub(
                    r"(emisor|proveedor|"
                    r"nif|cif|:)",
                    "",
                    line,
                    flags=re.IGNORECASE
                ).strip()

                if (
                    clean
                    and
                    len(clean) > 3
                ):

                    issuer_name = clean

            elif (
                "cliente" in lower
                or
                "receptor" in lower
            ):

                clean = re.sub(
                    r"(cliente|receptor|"
                    r"nif|cif|:)",
                    "",
                    line,
                    flags=re.IGNORECASE
                ).strip()

                if (
                    clean
                    and
                    len(clean) > 3
                ):

                    receiver_name = clean

        text_lower = text.lower()

        iva_rate, irpf_rate = (
            TaxEngine.resolve_rates(
                text_lower
            )
        )

        (
            base_imponible,
            iva_amount,
            irpf_amount,
            total_amount
        ) = TaxEngine.extract_financials(
            text,
            text_lower,
            iva_rate,
            irpf_rate
        )

        invoice_id_match = re.search(
            r"\b(?:factura\s+de\s+)"
            r"([A-Za-z0-9 ]+)"
            r"|"
            r"(?:factura"
            r"(?:\s+(?:número|nº|num))?"
            r"|número|nº|num)"
            r"[\s#:]*"
            r"([A-Za-z0-9\-]*\d"
            r"[A-Za-z0-9\-]*)",
            text,
            re.IGNORECASE
        )

        if invoice_id_match:

            invoice_id = (
                invoice_id_match.group(1)
                or
                invoice_id_match.group(2)
            )

            invoice_id = (
                invoice_id
                .upper()
                .strip()
            )

        else:

            invoice_id = (
                f"FAC-"
                f"{int(datetime.now().timestamp())}"
            )

        return {
            "invoice_id": invoice_id,
            "date": date_str,
            "issuer_name": issuer_name,
            "issuer_nif": issuer_nif,
            "receiver_name": receiver_name,
            "receiver_nif": receiver_nif,
            "base_imponible": base_imponible,
            "iva_rate": iva_rate,
            "iva_amount": iva_amount,
            "irpf_rate": irpf_rate,
            "irpf_amount": irpf_amount,
            "total_amount": total_amount,
            "category": category,
            "quarter": quarter,
            "year": year
        }