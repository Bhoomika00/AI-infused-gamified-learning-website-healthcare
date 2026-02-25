import numpy as np
from typing import Tuple
from .embedding_service import embed_text, embed_texts, cosine_sim_matrix
from .topic_catalog import TOPIC_LABELS 

# build label vectors once
_LABEL_VECS = None
def _get_label_vecs():
    global _LABEL_VECS
    if _LABEL_VECS is None:
        _LABEL_VECS = embed_texts(TOPIC_LABELS)
    return _LABEL_VECS

def normalize_topic_from_text(question_or_title: str) -> Tuple[str, float]:
    """
    Returns (best_label, similarity) where similarity in [0,1].
    If low similarity, you can fallback to a default like 'General'.
    """
    qv = embed_text(question_or_title)
    L = _get_label_vecs()
    sims = (L @ qv.T)  # (len(labels),)
    idx = int(np.argmax(sims))
    return TOPIC_LABELS[idx], float(sims[idx])
