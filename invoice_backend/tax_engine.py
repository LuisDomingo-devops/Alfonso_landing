import re
import json
from datetime import datetime
from pathlib import Path
from typing import Any


RULES_PATH = (
    Path(__file__).resolve().parent
    / "tax_rules.json"
)


class TaxEngine:

    @staticmethod
    def load_rules() -> dict:

        if not RULES_PATH.exists():

            return {
                "iva_general_rate": 21.0,
                "irpf_profesionales_rate": 15.0,
            }

        with open(
            RULES_PATH,
            "r",
            encoding="utf-8",
        ) as file:

            return json.load(file)

    @staticmethod
    def number(
        value: Any,
    ) -> float:

        if value is None:
            return 0.0

        if isinstance(
            value,
            (int, float),
        ):
            return float(value)

        text = (
            str(value)
            .replace("€", "")
            .replace(" ", "")
            .strip()
        )

        if "," in text and "." in text:

            text = (
                text
                .replace(".", "")
                .replace(",", ".")
            )

        elif "," in text:

            text = text.replace(
                ",",
                ".",
            )

        try:

            return float(text)

        except ValueError:

            return 0.0

    @staticmethod
    def resolve_quarter(
        date_value: Any,
    ) -> tuple[int | None, int | None]:

        if not date_value:
            return None, None

        text = str(date_value)

        patterns = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
        ]

        for pattern in patterns:

            try:

                date = datetime.strptime(
                    text,
                    pattern,
                )

                quarter = (
                    (date.month - 1) // 3
                ) + 1

                return (
                    date.year,
                    quarter,
                )

            except ValueError:
                continue

        return None, None

    @classmethod
    def validate_invoice(
        cls,
        invoice: dict[str, Any],
    ) -> dict[str, Any]:

        result = dict(invoice)

        rules = cls.load_rules()

        default_iva = float(
            rules.get(
                "iva_general_rate",
                21.0,
            )
        )

        default_irpf = float(
            rules.get(
                "irpf_profesionales_rate",
                15.0,
            )
        )

        base = cls.number(
            result.get(
                "base_amount"
            )
        )

        vat_rate = cls.number(
            result.get(
                "vat_rate"
            )
        )

        vat = cls.number(
            result.get(
                "vat_amount"
            )
        )

        withholding_rate = cls.number(
            result.get(
                "withholding_rate"
            )
        )

        withholding = cls.number(
            result.get(
                "withholding_amount"
            )
        )

        total = cls.number(
            result.get(
                "total_amount"
            )
        )

        if (
            vat_rate <= 0
            and base > 0
        ):

            vat_rate = default_iva

        if (
            withholding_rate <= 0
            and withholding > 0
        ):

            withholding_rate = default_irpf

        if (
            base > 0
            and vat <= 0
        ):

            vat = round(
                base *
                vat_rate /
                100,
                2,
            )

        if (
            base > 0
            and withholding <= 0
            and withholding_rate > 0
        ):

            withholding = round(
                base *
                withholding_rate /
                100,
                2,
            )

        calculated_total = round(
            base +
            vat -
            withholding,
            2,
        )

        if (
            total <= 0
            and calculated_total > 0
        ):

            total = calculated_total

        year, quarter = (
            cls.resolve_quarter(
                result.get(
                    "date"
                )
            )
        )

        result.update(
            {
                "base_amount": round(
                    base,
                    2,
                ),
                "vat_rate": vat_rate,
                "vat_amount": round(
                    vat,
                    2,
                ),
                "withholding_rate":
                    withholding_rate,
                "withholding_amount":
                    round(
                        withholding,
                        2,
                    ),
                "total_amount": round(
                    total,
                    2,
                ),
                "year": year,
                "quarter": quarter,
                "calculated_total":
                    calculated_total,
            }
        )

        return result