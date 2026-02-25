# frontend/scripts/build_embeddings.py
import os, json, sys
import numpy as np
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from models import Base, Course, Lesson
from ai.embedding_service import embed_texts

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INDEX_DIR = os.path.join(BASE_DIR, "ai_index")
os.makedirs(INDEX_DIR, exist_ok=True)

engine = create_engine("mysql+pymysql://root:root123@localhost/coursebuilder", future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def build():
    db = SessionLocal()
    try:
        courses = db.query(Course).all()
        for c in courses:
            lessons = (
                db.query(Lesson)
                .filter(Lesson.course_id == c.id)
                .order_by(Lesson.position.asc())
                .all()
            )
            if not lessons:
                continue

            # text to embed: title + (optional) content snippet
            texts = []
            meta = []
            for l in lessons:
                t = (l.title or "").strip()
                # lightweight: title only is fine; you could append content excerpt
                texts.append(t if t else f"Lesson {l.id}")
                meta.append({"lesson_id": l.id, "title": l.title or "", "course_id": c.id})

            vecs = embed_texts(texts)  # (N, 384)
            slug = (c.source_file or "").replace(".json", "")
            npz_path = os.path.join(INDEX_DIR, f"{slug}_lessons.npz")
            json_path = os.path.join(INDEX_DIR, f"{slug}_lessons_meta.json")
            np.savez_compressed(npz_path, vectors=vecs)
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
            print(f"Indexed course: {c.name} -> {npz_path}")
    finally:
        db.close()

if __name__ == "__main__":
    build()
