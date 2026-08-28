import os
import csv
import time
from typing import Dict, Any, List, Set, Tuple, Optional
from app.schemas.evaluation import MetricItem, OverallMetrics, EvaluationResponse
from app.services.exception_detector import exception_detector
from app.services.data_generator import data_generator

TYPE_ALIASES = {
    "UNEXPECTED_FEE": "FEE_ANOMALY",
    "FEE_ANOMALY": "FEE_ANOMALY",
    "MISSING_SETTLEMENT": "MISSING_SETTLEMENT",
    "DUPLICATE_SETTLEMENT": "DUPLICATE_SETTLEMENT",
    "AMOUNT_MISMATCH": "AMOUNT_MISMATCH",
    "REFUND_MISMATCH": "REFUND_MISMATCH",
    "DELAYED_SETTLEMENT": "DELAYED_SETTLEMENT",
    "ORPHAN_SETTLEMENT": "ORPHAN_SETTLEMENT",
}


class ExceptionEvaluatorService:
    async def evaluate(self, dataset_id: str) -> EvaluationResponse:
        """
        Compares detected exceptions against ground truth labels without manipulating results.
        Calculates exact TP, FP, FN, Precision, Recall, and F1 per exception type and overall.
        """
        start_time = time.perf_counter()

        # 1. Ensure exceptions are detected
        detection_res = await exception_detector.detect_exceptions(dataset_id)
        detected_list, _ = await exception_detector.get_exceptions(dataset_id, limit=100000)

        # 2. Load Ground Truth
        ground_truth = self._load_ground_truth(dataset_id)

        # 3. Build lookup keys
        # Key format: (normalized_type, pid) or (normalized_type, sid) for orphan
        def make_key(item: Dict[str, Any]) -> str:
            raw_type = item.get("anomaly_type") or item.get("primary_exception_type") or item.get("exception_type", "")
            norm_type = TYPE_ALIASES.get(raw_type, raw_type)
            pid = str(item.get("payment_id") or "")
            sid = str(item.get("settlement_id") or "")
            if not sid and "evidence" in item and isinstance(item["evidence"], dict):
                sid = str(item["evidence"].get("details", {}).get("settlement_id") or "")
            
            if norm_type == "ORPHAN_SETTLEMENT":
                if sid:
                    return f"{norm_type}:{sid}"
                return f"{norm_type}:{pid}"
            return f"{norm_type}:{pid}"

        gt_keys_by_type: Dict[str, Set[str]] = {}
        for gt in ground_truth:
            raw_type = gt.get("anomaly_type", "")
            norm_type = TYPE_ALIASES.get(raw_type, raw_type)
            key = make_key(gt)
            gt_keys_by_type.setdefault(norm_type, set()).add(key)

        det_keys_by_type: Dict[str, Set[str]] = {}
        for det in detected_list:
            raw_type = det.get("primary_exception_type") or det.get("exception_type", "")
            norm_type = TYPE_ALIASES.get(raw_type, raw_type)
            key = make_key(det)
            det_keys_by_type.setdefault(norm_type, set()).add(key)

        # All evaluated types
        all_types = sorted(list(set(gt_keys_by_type.keys()) | set(det_keys_by_type.keys())))
        if not all_types:
            all_types = list(set(TYPE_ALIASES.values()))

        by_type_metrics: Dict[str, MetricItem] = {}
        total_tp = 0
        total_fp = 0
        total_fn = 0

        precisions: List[float] = []
        recalls: List[float] = []
        f1s: List[float] = []

        for t in all_types:
            gt_set = gt_keys_by_type.get(t, set())
            det_set = det_keys_by_type.get(t, set())

            tp = len(gt_set & det_set)
            fp = len(det_set - gt_set)
            fn = len(gt_set - det_set)

            total_tp += tp
            total_fp += fp
            total_fn += fn

            # Precision = TP / (TP + FP)
            if tp + fp > 0:
                p = tp / (tp + fp)
            else:
                p = 1.0 if len(gt_set) == 0 else 0.0

            # Recall = TP / (TP + FN)
            if tp + fn > 0:
                r = tp / (tp + fn)
            else:
                r = 1.0 if len(det_set) == 0 else 0.0

            # F1 = 2 * (P * R) / (P + R)
            if p + r > 0:
                f1 = (2 * p * r) / (p + r)
            else:
                f1 = 0.0

            by_type_metrics[t] = MetricItem(
                tp=tp,
                fp=fp,
                fn=fn,
                precision=round(p, 4),
                recall=round(r, 4),
                f1=round(f1, 4),
            )

            if len(gt_set) > 0 or len(det_set) > 0:
                precisions.append(p)
                recalls.append(r)
                f1s.append(f1)

        # Overall Micro metrics
        overall_p = (total_tp / (total_tp + total_fp)) if (total_tp + total_fp) > 0 else (1.0 if len(ground_truth) == 0 else 0.0)
        overall_r = (total_tp / (total_tp + total_fn)) if (total_tp + total_fn) > 0 else (1.0 if len(detected_list) == 0 else 0.0)
        overall_f1 = (2 * overall_p * overall_r / (overall_p + overall_r)) if (overall_p + overall_r) > 0 else 0.0

        # Macro metrics
        macro_p = (sum(precisions) / len(precisions)) if precisions else 1.0
        macro_r = (sum(recalls) / len(recalls)) if recalls else 1.0
        macro_f1 = (sum(f1s) / len(f1s)) if f1s else 1.0

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return EvaluationResponse(
            success=True,
            dataset_id=dataset_id,
            total_ground_truth=len(ground_truth),
            total_detected=len(detected_list),
            overall=OverallMetrics(
                total_tp=total_tp,
                total_fp=total_fp,
                total_fn=total_fn,
                precision=round(overall_p, 4),
                recall=round(overall_r, 4),
                f1=round(overall_f1, 4),
                macro_precision=round(macro_p, 4),
                macro_recall=round(macro_r, 4),
                macro_f1=round(macro_f1, 4),
            ),
            by_type=by_type_metrics,
            evaluation_time_ms=duration_ms,
        )

    def _load_ground_truth(self, dataset_id: str) -> List[Dict[str, Any]]:
        # 1. From cache
        if dataset_id in data_generator._cache:
            return data_generator._cache[dataset_id].get("ground_truth", [])

        # 2. From file
        folder = data_generator.get_dataset_folder(dataset_id)
        if folder:
            gt_file = os.path.join(folder, "ground_truth.csv")
            if os.path.exists(gt_file):
                rows = []
                with open(gt_file, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for r in reader:
                        rows.append(r)
                return rows

        return []


exception_evaluator = ExceptionEvaluatorService()
