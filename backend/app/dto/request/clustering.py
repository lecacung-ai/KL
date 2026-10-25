"""Clustering API request DTO."""

import uuid

from pydantic import BaseModel


class ClusteringRequest(BaseModel):
    dataset_id: uuid.UUID
    features: list[str] = []
    n_clusters: int = 3
    id_column: str | None = None


__all__ = ["ClusteringRequest"]
