"""Knowledge Engine package (docs/14): ingestion → retrieval → grounding verification."""
from app.services.rag.chunker import Chunk, chunk_document
from app.services.rag.embeddings import embed_texts
from app.services.rag.ingest import ingest_folder, ingest_file, sha256_file
from app.services.rag.retriever import search_corpus
from app.services.rag.verifier import verify_grounding

__all__ = [
    "Chunk",
    "chunk_document",
    "embed_texts",
    "ingest_file",
    "ingest_folder",
    "sha256_file",
    "search_corpus",
    "verify_grounding",
]
