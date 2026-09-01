from decimal import Decimal
from typing import List, Dict, Any, Tuple, Set
from app.schemas.upload import ValidationErrorItem, ValidationSummary
from app.utils.validation import (
    SCHEMA_COLUMNS,
    OPTIONAL_SCHEMA_COLUMNS,
    PRIMARY_KEYS,
    ALLOWED_PAYMENT_STATUSES,
    ALLOWED_SETTLEMENT_STATUSES,
    ALLOWED_REFUND_STATUSES,
    ALLOWED_CURRENCIES,
)
from app.services.data_normalizer import data_normalizer
from app.utils.money import to_decimal


class CSVValidatorService:
    def validate_and_normalize(
        self,
        file_type: str,
        headers: List[str],
        raw_rows: List[Dict[str, str]],
    ) -> Tuple[bool, List[Dict[str, Any]], List[ValidationErrorItem], List[ValidationErrorItem], ValidationSummary]:
        """
        Validates schema, data types, business constraints, and duplicate keys.
        Normalizes valid records into typed dictionaries.
        """
        errors: List[ValidationErrorItem] = []
        warnings: List[ValidationErrorItem] = []
        valid_records: List[Dict[str, Any]] = []

        expected_columns = SCHEMA_COLUMNS.get(file_type)
        if not expected_columns:
            errors.append(ValidationErrorItem(
                row=1,
                field="schema",
                code="UNKNOWN_FILE_TYPE",
                message=f"Unsupported file type '{file_type}'."
            ))
            return False, [], errors, warnings, ValidationSummary()

        # 1. Column header validation
        header_set = set(headers)
        expected_set = set(expected_columns)
        optional_set = OPTIONAL_SCHEMA_COLUMNS.get(file_type, set())

        missing_cols = expected_set - header_set
        if missing_cols:
            errors.append(ValidationErrorItem(
                row=1,
                field="headers",
                code="MISSING_REQUIRED_COLUMNS",
                message=f"Missing required columns: {', '.join(sorted(missing_cols))}."
            ))

        unexpected_cols = header_set - expected_set - optional_set
        if unexpected_cols:
            errors.append(ValidationErrorItem(
                row=1,
                field="headers",
                code="UNEXPECTED_COLUMNS",
                message=f"Unexpected columns found: {', '.join(sorted(unexpected_cols))}."
            ))

        # If headers are structurally broken, abort row processing
        if errors:
            summary = ValidationSummary(
                total_rows=len(raw_rows),
                valid_rows=0,
                invalid_rows=len(raw_rows)
            )
            return False, [], errors, warnings, summary

        # 2. Row level validation & duplicate tracking
        pk_field = PRIMARY_KEYS[file_type]
        seen_pks: Dict[str, int] = {}  # pk -> first seen row number

        for row in raw_rows:
            row_num = int(row.get("_row_number", 0))
            row_errors: List[ValidationErrorItem] = []

            # Check primary key duplication
            pk_val = row.get(pk_field, "").strip()
            if not pk_val:
                row_errors.append(ValidationErrorItem(
                    row=row_num,
                    field=pk_field,
                    code="EMPTY_PRIMARY_KEY",
                    message=f"Primary key '{pk_field}' cannot be empty."
                ))
            else:
                if pk_val in seen_pks:
                    first_row = seen_pks[pk_val]
                    row_errors.append(ValidationErrorItem(
                        row=row_num,
                        field=pk_field,
                        code="DUPLICATE_IDENTIFIER",
                        message=f"Duplicate {pk_field} '{pk_val}'. First defined on row {first_row}.",
                        raw_value=pk_val
                    ))
                else:
                    seen_pks[pk_val] = row_num

            # Type & constraint validation by file type
            if file_type == "payments":
                self._validate_payment_row(row, row_num, row_errors)
            elif file_type == "settlements":
                self._validate_settlement_row(row, row_num, row_errors)
            elif file_type == "refunds":
                self._validate_refund_row(row, row_num, row_errors)
            elif file_type == "fees":
                self._validate_fee_row(row, row_num, row_errors)

            if row_errors:
                errors.extend(row_errors)
            else:
                # Normalize and collect valid record
                try:
                    if file_type == "payments":
                        norm = data_normalizer.normalize_payment(row)
                    elif file_type == "settlements":
                        norm = data_normalizer.normalize_settlement(row)
                    elif file_type == "refunds":
                        norm = data_normalizer.normalize_refund(row)
                    elif file_type == "fees":
                        norm = data_normalizer.normalize_fee(row)
                    valid_records.append(norm)
                except Exception as ex:
                    errors.append(ValidationErrorItem(
                        row=row_num,
                        field="normalization",
                        code="NORMALIZATION_ERROR",
                        message=f"Failed to normalize row: {str(ex)}"
                    ))

        total_rows = len(raw_rows)
        valid_count = len(valid_records)
        invalid_count = total_rows - valid_count
        summary = ValidationSummary(
            total_rows=total_rows,
            valid_rows=valid_count,
            invalid_rows=invalid_count
        )
        is_success = len(errors) == 0

        return is_success, valid_records, errors, warnings, summary

    def _validate_money_field(
        self,
        raw_val: str,
        field_name: str,
        row_num: int,
        errors: List[ValidationErrorItem],
        allow_zero: bool = True
    ) -> bool:
        if not raw_val or raw_val.strip() == "":
            errors.append(ValidationErrorItem(
                row=row_num,
                field=field_name,
                code="MISSING_AMOUNT",
                message=f"Field '{field_name}' is required."
            ))
            return False

        try:
            d = to_decimal(raw_val)
            if not allow_zero and d <= Decimal("0.00"):
                errors.append(ValidationErrorItem(
                    row=row_num,
                    field=field_name,
                    code="NON_POSITIVE_AMOUNT",
                    message=f"Field '{field_name}' must be greater than zero.",
                    raw_value=raw_val
                ))
                return False
            if d < Decimal("0.00"):
                errors.append(ValidationErrorItem(
                    row=row_num,
                    field=field_name,
                    code="NEGATIVE_AMOUNT",
                    message=f"Field '{field_name}' must be a non-negative monetary value.",
                    raw_value=raw_val
                ))
                return False
            return True
        except ValueError:
            errors.append(ValidationErrorItem(
                row=row_num,
                field=field_name,
                code="INVALID_AMOUNT",
                message=f"Field '{field_name}' must be a valid numeric monetary value.",
                raw_value=raw_val
            ))
            return False

    def _validate_date_field(
        self,
        raw_val: str,
        field_name: str,
        row_num: int,
        errors: List[ValidationErrorItem]
    ) -> bool:
        if not raw_val or raw_val.strip() == "":
            errors.append(ValidationErrorItem(
                row=row_num,
                field=field_name,
                code="MISSING_DATE",
                message=f"Date field '{field_name}' is required."
            ))
            return False
        try:
            data_normalizer.parse_datetime(raw_val)
            return True
        except ValueError:
            errors.append(ValidationErrorItem(
                row=row_num,
                field=field_name,
                code="INVALID_DATE_FORMAT",
                message=f"Field '{field_name}' has an invalid date format. Expected ISO-8601 or YYYY-MM-DD.",
                raw_value=raw_val
            ))
            return False

    def _validate_payment_row(self, row: Dict[str, str], row_num: int, errors: List[ValidationErrorItem]):
        # Required strings
        for f in ("order_id", "merchant_id"):
            if not row.get(f, "").strip():
                errors.append(ValidationErrorItem(
                    row=row_num, field=f, code=f"MISSING_{f.upper()}", message=f"Field '{f}' is required."
                ))

        # Amount
        self._validate_money_field(row.get("amount", ""), "amount", row_num, errors, allow_zero=False)

        # Currency
        curr = row.get("currency", "").strip().upper()
        if not curr:
            errors.append(ValidationErrorItem(
                row=row_num, field="currency", code="MISSING_CURRENCY", message="Currency is required."
            ))
        elif curr not in ALLOWED_CURRENCIES:
            errors.append(ValidationErrorItem(
                row=row_num, field="currency", code="INVALID_CURRENCY",
                message=f"Unsupported currency '{curr}'. Allowed: {', '.join(sorted(ALLOWED_CURRENCIES))}.",
                raw_value=row.get("currency")
            ))

        # Status
        status = row.get("payment_status", "").strip().upper()
        if not status:
            errors.append(ValidationErrorItem(
                row=row_num, field="payment_status", code="MISSING_STATUS", message="Payment status is required."
            ))
        elif status not in ALLOWED_PAYMENT_STATUSES:
            errors.append(ValidationErrorItem(
                row=row_num, field="payment_status", code="INVALID_PAYMENT_STATUS",
                message=f"Invalid payment status '{status}'. Allowed: {', '.join(sorted(ALLOWED_PAYMENT_STATUSES))}.",
                raw_value=row.get("payment_status")
            ))

        # Date
        self._validate_date_field(row.get("created_at", ""), "created_at", row_num, errors)

    def _validate_settlement_row(self, row: Dict[str, str], row_num: int, errors: List[ValidationErrorItem]):
        if not row.get("payment_id", "").strip():
            errors.append(ValidationErrorItem(
                row=row_num, field="payment_id", code="MISSING_PAYMENT_ID", message="Field 'payment_id' is required."
            ))

        self._validate_money_field(row.get("settlement_amount", ""), "settlement_amount", row_num, errors, allow_zero=True)

        status = row.get("settlement_status", "").strip().upper()
        if status and status not in ALLOWED_SETTLEMENT_STATUSES:
            errors.append(ValidationErrorItem(
                row=row_num, field="settlement_status", code="INVALID_SETTLEMENT_STATUS",
                message=f"Invalid settlement status '{status}'. Allowed: {', '.join(sorted(ALLOWED_SETTLEMENT_STATUSES))}.",
                raw_value=row.get("settlement_status")
            ))

        self._validate_date_field(row.get("settlement_date", ""), "settlement_date", row_num, errors)

    def _validate_refund_row(self, row: Dict[str, str], row_num: int, errors: List[ValidationErrorItem]):
        if not row.get("payment_id", "").strip():
            errors.append(ValidationErrorItem(
                row=row_num, field="payment_id", code="MISSING_PAYMENT_ID", message="Field 'payment_id' is required."
            ))

        self._validate_money_field(row.get("refund_amount", ""), "refund_amount", row_num, errors, allow_zero=False)

        status = row.get("refund_status", "").strip().upper()
        if status and status not in ALLOWED_REFUND_STATUSES:
            errors.append(ValidationErrorItem(
                row=row_num, field="refund_status", code="INVALID_REFUND_STATUS",
                message=f"Invalid refund status '{status}'. Allowed: {', '.join(sorted(ALLOWED_REFUND_STATUSES))}.",
                raw_value=row.get("refund_status")
            ))

        self._validate_date_field(row.get("refund_date", ""), "refund_date", row_num, errors)

    def _validate_fee_row(self, row: Dict[str, str], row_num: int, errors: List[ValidationErrorItem]):
        self._validate_money_field(row.get("fee_amount", ""), "fee_amount", row_num, errors, allow_zero=True)
        self._validate_money_field(row.get("tax_amount", "0"), "tax_amount", row_num, errors, allow_zero=True)


csv_validator = CSVValidatorService()
