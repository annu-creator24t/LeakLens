import os
import json
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from app.schemas.generator import GeneratorConfig, GeneratorResponse, DatasetMetadata
from app.services.data_generator import data_generator

router = APIRouter(prefix="/generator", tags=["Synthetic Data Generator"])

ALLOWED_DOWNLOAD_FILES = {
    "payments": "payments.csv",
    "settlements": "settlements.csv",
    "refunds": "refunds.csv",
    "fees": "fees.csv",
    "ground_truth": "ground_truth.csv",
    "metadata": "metadata.json",
}


@router.post("/generate", response_model=GeneratorResponse)
async def generate_dataset(config: GeneratorConfig):
    """
    Generates a realistic financial dataset with deterministic relationships and controlled ground-truth anomalies.
    """
    try:
        response, _ = data_generator.generate(config)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {str(e)}"
        )


@router.get("/{dataset_id}/metadata", response_model=DatasetMetadata)
async def get_dataset_metadata(dataset_id: str):
    """
    Retrieves metadata and anomaly statistics for a generated dataset.
    """
    folder = data_generator.get_dataset_folder(dataset_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found."
        )

    meta_file = os.path.join(folder, "metadata.json")
    if not os.path.exists(meta_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Metadata for dataset '{dataset_id}' not found."
        )

    with open(meta_file, "r", encoding="utf-8") as f:
        meta_dict = json.load(f)

    return DatasetMetadata(**meta_dict)


@router.get("/{dataset_id}/download/{file_type}")
async def download_generated_file(dataset_id: str, file_type: str):
    """
    Downloads a specific generated CSV dataset or ground_truth.csv file.
    """
    normalized_type = file_type.lower().replace(".csv", "").replace(".json", "")
    target_filename = ALLOWED_DOWNLOAD_FILES.get(normalized_type)
    
    if not target_filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file_type}'. Allowed types: {list(ALLOWED_DOWNLOAD_FILES.keys())}"
        )

    folder = data_generator.get_dataset_folder(dataset_id)
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset_id}' not found."
        )

    file_path = os.path.join(folder, target_filename)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{target_filename}' not found for dataset '{dataset_id}'."
        )

    media_type = "application/json" if target_filename.endswith(".json") else "text/csv"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=f"{dataset_id}_{target_filename}"
    )
