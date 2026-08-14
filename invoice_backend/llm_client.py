import json
import os
from typing import Any

from google import genai
from google.genai import types


class GeminiClient:

    def __init__(self):

        self.api_key = os.getenv(
            "GEMINI_API_KEY"
        )

        if not self.api_key:

            raise RuntimeError(
                "GEMINI_API_KEY no está configurada."
            )

        self.model = os.getenv(
            "GEMINI_MODEL_NAME",
            "gemini-3.1-flash-lite",
        )

        self.client = genai.Client(
            api_key=self.api_key
        )

    def _generate(
        self,
        prompt: str,
    ) -> str:

        response = (
            self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                ),
            )
        )

        text = getattr(
            response,
            "text",
            None,
        )

        if not text:

            raise RuntimeError(
                "Gemini no ha devuelto contenido."
            )

        return text.strip()

    def analyse_invoice(
        self,
        text: str,
    ) -> dict[str, Any]:

        from invoice_processor import (
            build_llm_invoice_prompt
        )

        prompt = (
            build_llm_invoice_prompt(
                text
            )
        )

        response = self._generate(
            prompt
        )

        response = (
            response
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        try:

            return json.loads(
                response
            )

        except json.JSONDecodeError as exc:

            raise RuntimeError(
                "Gemini ha devuelto una "
                "respuesta que no es JSON válido."
            ) from exc

    def generate_explanation(
        self,
        invoice: dict[str, Any],
    ) -> str:

        from invoice_processor import (
            build_response_prompt
        )

        prompt = (
            build_response_prompt(
                invoice
            )
        )

        return self._generate(
            prompt
        )