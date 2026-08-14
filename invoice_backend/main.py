from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from invoice_processor import process_invoice
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Alfonso Invoice Demo",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".tiff",
    ".bmp",
}


MAX_FILE_SIZE = 10 * 1024 * 1024


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "alfonso-invoice-demo",
    }


@app.post("/api/invoice-demo")
async def invoice_demo(
    file: UploadFile = File(...)
):
    filename = file.filename or "documento"

    extension = Path(
        filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                "Formato no soportado. "
                "Utiliza PDF, JPG, JPEG, PNG o TIFF."
            ),
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="El archivo está vacío.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="El archivo supera los 10 MB.",
        )

    with TemporaryDirectory(
        prefix="alfonso_demo_"
    ) as temp_dir:

        path = (
            Path(temp_dir) /
            filename
        )

        path.write_bytes(content)

        try:
            result = process_invoice(
                path=path,
                filename=filename,
            )

            return result

        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=str(exc),
            ) from exc

        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Se ha producido un error "
                    "procesando el documento."
                ),
            ) from exc