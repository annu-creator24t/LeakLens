from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Union, Optional

MONEY_PRECISION = Decimal("0.01")


def to_decimal(val: Union[str, int, float, Decimal, None]) -> Decimal:
    """
    Safely converts a monetary input into a standard quantized Decimal (2 decimal places).
    Never performs direct float-based arithmetic to avoid floating-point representation drift.
    """
    if val is None or val == "":
        raise ValueError("Monetary value cannot be empty or None")

    if isinstance(val, (int, Decimal)):
        d = Decimal(str(val))
    elif isinstance(val, float):
        # Convert float via string representation to avoid immediate IEEE 754 precision artifacts
        d = Decimal(str(val))
    elif isinstance(val, str):
        cleaned = val.strip().replace(",", "").replace("$", "").replace("₹", "").replace("INR", "").strip()
        try:
            d = Decimal(cleaned)
        except InvalidOperation:
            raise ValueError(f"Invalid monetary string: '{val}'")
    else:
        raise ValueError(f"Unsupported type for monetary conversion: {type(val)}")

    return d.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


def format_money(val: Decimal, currency: str = "INR") -> str:
    """Formats a Decimal monetary value into a human-readable display string."""
    symbol = "₹" if currency.upper() == "INR" else f"{currency} "
    return f"{symbol}{val:,.2f}"
