import os
import csv
import json
import time
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Tuple, Optional
from app.utils.money import to_decimal
from app.schemas.generator import GeneratorConfig, DatasetMetadata, GeneratorResponse
from app.services.anomaly_injector import anomaly_injector

# Base price distribution in INR
REALISTIC_AMOUNTS = [
    Decimal("49.00"), Decimal("99.00"), Decimal("149.00"), Decimal("199.00"),
    Decimal("299.00"), Decimal("499.00"), Decimal("799.00"), Decimal("999.00"),
    Decimal("1299.00"), Decimal("1499.00"), Decimal("1999.00"), Decimal("2499.00"),
    Decimal("3499.00"), Decimal("4999.00"), Decimal("7499.00"), Decimal("9999.00"),
    Decimal("14999.00"), Decimal("24999.00")
]

PAYMENT_METHODS = ["UPI", "CARD", "NETBANKING", "WALLET"]
PAYMENT_METHOD_WEIGHTS = [0.55, 0.25, 0.15, 0.05]

# Standard MDR fee rates
DEFAULT_MDR_RATE = Decimal("0.018")  # 1.8%
GST_TAX_RATE = Decimal("0.18")       # 18% on fee


class DataGeneratorService:
    def __init__(self):
        # Base generated data directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.generated_dir = os.path.join(base_dir, "data", "generated")
        os.makedirs(self.generated_dir, exist_ok=True)
        # In-memory session cache for fast test/API access
        self._cache: Dict[str, Dict[str, Any]] = {}

    def generate(self, config: GeneratorConfig) -> Tuple[GeneratorResponse, DatasetMetadata]:
        start_time = time.perf_counter()

        dataset_id = f"gen_{uuid.uuid4().hex[:10]}"
        rng = random.Random(config.seed)

        # 1. Generate Clean Mathematical Baseline
        payments, settlements, refunds, fees = self._generate_clean_dataset(
            rng=rng,
            count=config.transaction_count,
            merchant_id=config.merchant_id
        )

        # 2. Inject Controlled Anomalies
        total_anomaly_target = int(config.transaction_count * config.anomaly_rate)
        
        (
            final_payments,
            final_settlements,
            final_refunds,
            final_fees,
            ground_truth,
            breakdown
        ) = anomaly_injector.inject_anomalies(
            rng=rng,
            dataset_id=dataset_id,
            payments=payments,
            settlements=settlements,
            refunds=refunds,
            fees=fees,
            config=config.anomalies,
            total_anomaly_target=total_anomaly_target
        )

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # 3. Export to Disk
        dataset_folder = os.path.join(self.generated_dir, dataset_id)
        os.makedirs(dataset_folder, exist_ok=True)

        self._export_csv(
            os.path.join(dataset_folder, "payments.csv"),
            ["payment_id", "order_id", "merchant_id", "amount", "currency", "payment_status", "payment_method", "created_at"],
            final_payments
        )
        self._export_csv(
            os.path.join(dataset_folder, "settlements.csv"),
            ["settlement_id", "payment_id", "settlement_amount", "settlement_status", "settlement_date"],
            final_settlements
        )
        self._export_csv(
            os.path.join(dataset_folder, "refunds.csv"),
            ["refund_id", "payment_id", "refund_amount", "refund_status", "refund_date"],
            final_refunds
        )
        self._export_csv(
            os.path.join(dataset_folder, "fees.csv"),
            ["payment_id", "fee_amount", "tax_amount"],
            final_fees
        )
        self._export_csv(
            os.path.join(dataset_folder, "ground_truth.csv"),
            ["anomaly_id", "dataset_id", "anomaly_type", "payment_id", "settlement_id", "refund_id", "expected_amount", "actual_amount", "difference", "severity", "description"],
            ground_truth
        )

        metadata = DatasetMetadata(
            dataset_id=dataset_id,
            seed=config.seed,
            transaction_count=config.transaction_count,
            anomaly_rate=config.anomaly_rate,
            created_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            anomaly_counts=breakdown,
            generation_duration_ms=duration_ms,
            generator_version="1.0.0",
            merchant_id=config.merchant_id
        )

        with open(os.path.join(dataset_folder, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata.model_dump(), f, indent=2)

        # Cache in memory
        self._cache[dataset_id] = {
            "metadata": metadata,
            "folder": dataset_folder,
            "payments": final_payments,
            "settlements": final_settlements,
            "refunds": final_refunds,
            "fees": final_fees,
            "ground_truth": ground_truth,
        }

        response = GeneratorResponse(
            success=True,
            dataset_id=dataset_id,
            transaction_count=config.transaction_count,
            anomaly_count=len(ground_truth),
            generation_time_ms=duration_ms,
            anomaly_breakdown=breakdown,
            files_available=["payments.csv", "settlements.csv", "refunds.csv", "fees.csv", "ground_truth.csv", "metadata.json"]
        )

        return response, metadata

    def _generate_clean_dataset(
        self,
        rng: random.Random,
        count: int,
        merchant_id: str
    ) -> Tuple[
        List[Dict[str, Any]],
        List[Dict[str, Any]],
        List[Dict[str, Any]],
        List[Dict[str, Any]]
    ]:
        payments: List[Dict[str, Any]] = []
        settlements: List[Dict[str, Any]] = []
        refunds: List[Dict[str, Any]] = []
        fees: List[Dict[str, Any]] = []

        base_date = datetime(2026, 3, 1, 9, 0, 0)
        refund_counter = 1

        for i in range(1, count + 1):
            payment_id = f"PAY_{i:06d}"
            order_id = f"ORD_{i:06d}"
            
            # Timestamp staggered over weeks
            tx_time = base_date + timedelta(minutes=(i * 3) + rng.randint(0, 120))
            created_at_str = tx_time.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Amount selection
            amount = rng.choice(REALISTIC_AMOUNTS)
            
            # Payment Method
            method = rng.choices(PAYMENT_METHODS, weights=PAYMENT_METHOD_WEIGHTS, k=1)[0]
            
            # Status (96% success, 3% failed, 1% cancelled)
            status_roll = rng.random()
            if status_roll < 0.96:
                status = "SUCCESS"
            elif status_roll < 0.99:
                status = "FAILED"
            else:
                status = "CANCELLED"

            payment_doc = {
                "payment_id": payment_id,
                "order_id": order_id,
                "merchant_id": merchant_id,
                "amount": amount,
                "currency": "INR",
                "payment_status": status,
                "payment_method": method,
                "created_at": created_at_str,
            }
            payments.append(payment_doc)

            # Only SUCCESS payments generate fees, refunds, and settlements in clean baseline
            if status != "SUCCESS":
                continue

            # 1. Deterministic Fee & Tax Calculation
            fee_amount = (amount * DEFAULT_MDR_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            tax_amount = (fee_amount * GST_TAX_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            fees.append({
                "payment_id": payment_id,
                "fee_amount": fee_amount,
                "tax_amount": tax_amount,
            })

            # 2. Realistic Refund (~6% of successful payments)
            refund_amount = Decimal("0.00")
            if rng.random() < 0.06:
                ref_id = f"REF_{refund_counter:05d}"
                refund_counter += 1
                
                # Clean partial refunds (10% to 50% of payment amount) ensuring net settlement is positive
                refund_ratio = to_decimal(rng.choice(["0.10", "0.20", "0.35", "0.50"]))
                refund_amount = (amount * refund_ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                refund_date = (tx_time + timedelta(hours=rng.randint(2, 24))).strftime("%Y-%m-%dT%H:%M:%SZ")
                refunds.append({
                    "refund_id": ref_id,
                    "payment_id": payment_id,
                    "refund_amount": refund_amount,
                    "refund_status": "PROCESSED",
                    "refund_date": refund_date,
                })

            # 3. Deterministic Clean Settlement
            # Expected Settlement = Payment - Refund - Fee - Tax
            expected_settlement = (amount - refund_amount - fee_amount - tax_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Standard T+2 Settlement SLA
            settlement_date = (tx_time + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
            settlements.append({
                "settlement_id": f"SETTL_{i:06d}",
                "payment_id": payment_id,
                "settlement_amount": expected_settlement,
                "settlement_status": "SETTLED",
                "settlement_date": settlement_date,
            })

        return payments, settlements, refunds, fees

    def _export_csv(self, file_path: str, headers: List[str], records: List[Dict[str, Any]]):
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            for r in records:
                row_dict = {h: r.get(h, "") for h in headers}
                writer.writerow(row_dict)

    def get_dataset_folder(self, dataset_id: str) -> Optional[str]:
        folder = os.path.join(self.generated_dir, dataset_id)
        if os.path.exists(folder):
            return folder
        return None


data_generator = DataGeneratorService()
