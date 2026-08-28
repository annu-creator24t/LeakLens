from datetime import datetime
from decimal import Decimal
from typing import Dict, Any
from app.utils.money import to_decimal

DATE_FORMATS = [
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
    "%d-%m-%Y %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y",
    "%d/%m/%Y",
]


class DataNormalizerService:
    @staticmethod
    def parse_datetime(val: str) -> str:
        """Parses a date string into standard ISO-8601 UTC representation."""
        cleaned = val.strip()
        # If already standard ISO with Z
        for fmt in DATE_FORMATS:
            try:
                dt = datetime.strptime(cleaned, fmt)
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                continue

        # Try fromisoformat as fallback
        try:
            dt = datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            raise ValueError(f"Unable to parse date string: '{val}'")

    def normalize_payment(self, raw: Dict[str, str]) -> Dict[str, Any]:
        """Normalizes a raw payment row."""
        return {
            "payment_id": raw.get("payment_id", "").strip(),
            "order_id": raw.get("order_id", "").strip(),
            "merchant_id": raw.get("merchant_id", "").strip(),
            "amount": to_decimal(raw.get("amount", "")),
            "currency": raw.get("currency", "INR").strip().upper(),
            "payment_status": raw.get("payment_status", "").strip().upper(),
            "payment_method": raw.get("payment_method", "").strip().upper() if raw.get("payment_method") else None,
            "created_at": self.parse_datetime(raw.get("created_at", "")),
        }

    def normalize_settlement(self, raw: Dict[str, str]) -> Dict[str, Any]:
        """Normalizes a raw settlement row."""
        return {
            "settlement_id": raw.get("settlement_id", "").strip(),
            "payment_id": raw.get("payment_id", "").strip(),
            "settlement_amount": to_decimal(raw.get("settlement_amount", "")),
            "settlement_status": raw.get("settlement_status", "").strip().upper(),
            "settlement_date": self.parse_datetime(raw.get("settlement_date", "")),
        }

    def normalize_refund(self, raw: Dict[str, str]) -> Dict[str, Any]:
        """Normalizes a raw refund row."""
        return {
            "refund_id": raw.get("refund_id", "").strip(),
            "payment_id": raw.get("payment_id", "").strip(),
            "refund_amount": to_decimal(raw.get("refund_amount", "")),
            "refund_status": raw.get("refund_status", "").strip().upper(),
            "refund_date": self.parse_datetime(raw.get("refund_date", "")),
        }

    def normalize_fee(self, raw: Dict[str, str]) -> Dict[str, Any]:
        """Normalizes a raw fee row."""
        return {
            "payment_id": raw.get("payment_id", "").strip(),
            "fee_amount": to_decimal(raw.get("fee_amount", "")),
            "tax_amount": to_decimal(raw.get("tax_amount", "0")),
        }


data_normalizer = DataNormalizerService()
