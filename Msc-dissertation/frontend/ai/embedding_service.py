
import os
import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer

# single global model (fast to reuse within the process)
_MODEL = None

def get_model():
    global _MODEL
    if _MODEL is None:
        # small, fast, good quality for recommendations / topic mapping
        _MODEL = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _MODEL

def embed_texts(texts: List[str]) -> np.ndarray:
    model = get_model()
    vecs = model.encode(texts, batch_size=64, show_progress_bar=False, normalize_embeddings=True)
    return np.asarray(vecs, dtype=np.float32)  # shape: (N, 384)

def embed_text(text: str) -> np.ndarray:
    return embed_texts([text])[0]

def cosine_sim_matrix(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    # A: (n, d)  B: (m, d)  -> (n, m)
    return (A @ B.T)  # already L2-normalized -> dot = cosine
