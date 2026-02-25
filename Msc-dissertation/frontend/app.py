from flask import Flask, send_from_directory, jsonify, request, session, redirect, g
from flask_session import Session
from flask_cors import CORS 
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import os, json, sys, glob
from datetime import date, datetime
import math, re
import os, time, json, math, re
import requests
from datetime import datetime, timedelta
from urllib.parse import urlencode
from sqlalchemy import or_

# SQLAlchemy
from sqlalchemy import create_engine, and_, func
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.exc import OperationalError

# === Flask App Setup ===
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
frontend_dist_path = os.path.join(BASE_DIR, 'dist')  # Vite build output (frontend/dist)
app = Flask(__name__, static_folder=frontend_dist_path, static_url_path='')
app.secret_key = 'your_secret_key'
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# === Add local imports to path ===
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
backend_dir = os.path.abspath(os.path.join(BASE_DIR, '../src/Backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# === DB Models & Backend Logic ===
from models import (
    Base, User, Course, Lesson, Module, Question,
    QuizAttempt, UserCourseProgress, TopicMastery, UserBadge, LessonDifficulty,
    ExternalResource
)
from summarise import build_course_from_pdf
from extract_content import extract_training_from_pdf
from dotenv import load_dotenv
load_dotenv()  # This loads variables from .env file
try:
    from ai.topic_normalizer import normalize_topic_from_text
    from ai.embedding_service import embed_texts, embed_text
    from ai.topic_catalog import TOPIC_LABELS
except Exception as e:
    import importlib.util, pathlib, traceback
    AI_DIR = pathlib.Path(BASE_DIR) / "ai"
    print("[AI Import] Falling back to file-loader. BASE_DIR:", BASE_DIR)
    print("[AI Import] AI_DIR exists?", AI_DIR.exists())
    if AI_DIR.exists():
        print("[AI Import] AI_DIR contents:", list(AI_DIR.glob("*")))
    else:
        print("[AI Import] ERROR: ai/ directory not found next to app.py")

    def _load(name, file):
        spec = importlib.util.spec_from_file_location(name, str(AI_DIR / file))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    topic_catalog = _load("ai.topic_catalog", "topic_catalog.py")
    embedding_service = _load("ai.embedding_service", "embedding_service.py")
    topic_normalizer = _load("ai.topic_normalizer", "topic_normalizer.py")

    TOPIC_LABELS = topic_catalog.TOPIC_LABELS
    embed_texts = embedding_service.embed_texts
    embed_text  = embedding_service.embed_text
    normalize_topic_from_text = topic_normalizer.normalize_topic_from_text

CORS(app, supports_credentials=True)

import numpy as np

# ---------- Badges ----------
BADGES = {
    "FIRST_QUIZ": {"name": "First Quiz", "desc": "Completed your first quiz.", "icon": "first-quiz.png"},
    "PERFECT_100": {"name": "Perfect 100", "desc": "Scored 100 on a quiz.", "icon": "perfect-score.png"},
    "STREAK_3": {"name": "3-Day Streak", "desc": "Practice 3 days in a row.", "icon": "streak-3.png"},
    "STREAK_7": {"name": "7-Day Streak", "desc": "Practice 7 days in a row.", "icon": "streak-7.png"},
    "COMEBACK": {"name": "Comeback", "desc": "Bounce back from a low score to high.", "icon": "comeback.png"},
    "RETRY_MASTER": {"name": "Retry Master", "desc": "Raised a weak topic above 80% accuracy.", "icon": "retry.png"},
}

# === DB Setup: resilient engine + scoped sessions ===
engine = create_engine(
    "mysql+pymysql://root:root123@localhost/healthcare_db",
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10, "charset": "utf8mb4"},
    future=True,
)
SessionLocal = scoped_session(
    sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# Teardown: remove session after each request
@app.teardown_appcontext
def remove_session(exc=None):
    SessionLocal.remove()

# One-shot reconnect wrapper for read-heavy endpoints
def with_reconnect(fn):
    @wraps(fn)
    def inner(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except OperationalError:
            SessionLocal.remove()
            return fn(*args, **kwargs)
    return inner

# Helpers
def _get_or_create_daily_progress(db, user_id: int, course_id: int) -> UserCourseProgress:
    today = date.today()
    row = db.query(UserCourseProgress).filter_by(
        user_id=user_id, course_id=course_id, day=today
    ).first()
    if not row:
        row = UserCourseProgress(
            user_id=user_id,
            course_id=course_id,
            day=today,
            daily_limit=3,
            lessons_completed=0,
            current_position=0,
            total_score_today=0,
        )
        db.add(row)
        db.commit()
    return row

def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        u = session.get('user')
        if not u or u.get('role') != 'admin':
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

def _lesson_text(lesson_dict: dict) -> str:
    return (lesson_dict.get("full_content")
            or lesson_dict.get("lesson_summary")
            or lesson_dict.get("content")
            or lesson_dict.get("title")
            or lesson_dict.get("lesson_title")
            or "").strip()

def _bucket_label(p: float) -> str:
    if p < 0.33: return "easy"
    if p < 0.66: return "medium"
    return "hard"

def _tokenize(s: str):
    return re.findall(r"[A-Za-z]+", s.lower())

TRUSTED_SOURCES = [
    ("CDC",  "https://tools.cdc.gov/api/v2/resources/media"),
    ("WHO",  "https://www.who.int/rss-feeds/news-english.xml"),
    ("NHS",  "https://www.nhs.uk/news/feed/"),
]
# NOTE: leave this as env var name; if unset we simply skip SerpAPI
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
CACHE_TTL_MIN = 360
def _clean(s: str) -> str:
    return (s or "").strip()

def _now() -> datetime:
    return datetime.utcnow()

def _is_fresh(dt: datetime, ttl_min: int) -> bool:
    return (dt and (_now() - dt) < timedelta(minutes=ttl_min))

def _search_serpapi(query: str, limit: int = 8):
    if not SERPAPI_KEY:
        return []
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": min(10, max(1, limit)),
        "hl": "en",
        "safe": "active",
    }
    url = "https://serpapi.com/search.json?" + urlencode(params)
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    data = r.json()
    items = []
    for res in (data.get("organic_results") or []):
        title = _clean(res.get("title"))
        link  = _clean(res.get("link"))
        snip  = _clean(res.get("snippet"))
        if any(d in link for d in ["cdc.gov","who.int","nhs.uk","ncbi.nlm.nih.gov","nice.org.uk","ema.europa.eu"]):
            items.append({"title": title, "url": link, "snippet": snip, "source": "google"})
    return items[:limit]

def _fetch_cdc_json(query: str, limit: int = 8):
    try:
        p = {"search": query, "max": min(10, limit)}
        r = requests.get(TRUSTED_SOURCES[0][1], params=p, timeout=15)
        r.raise_for_status()
        data = r.json()
        items = []
        for it in (data.get("results") or []):
            items.append({
                "title": _clean(it.get("name") or it.get("title")),
                "url": _clean(it.get("url") or it.get("permalink")),
                "snippet": _clean(it.get("description")),
                "source": "cdc"
            })
        return items[:limit]
    except Exception:
        return []

def _fetch_rss(url: str, limit: int = 8):
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        text = r.text
        items = []
        for m in re.findall(r"<item>(.*?)</item>", text, flags=re.S|re.I):
            title = re.search(r"<title>(.*?)</title>", m, flags=re.S|re.I)
            link  = re.search(r"<link>(.*?)</link>", m,  flags=re.S|re.I)
            desc  = re.search(r"<description>(.*?)</description>", m, flags=re.S|re.I)
            items.append({
                "title": _clean(re.sub("<.*?>","",title.group(1))) if title else "",
                "url": _clean(re.sub("<.*?>","",link.group(1))) if link else "",
                "snippet": _clean(re.sub("<.*?>","",desc.group(1))) if desc else "",
                "source": "rss"
            })
        return items[:limit]
    except Exception:
        return []

def _rank_and_cache(db, topic: str, candidates: list):
    if not candidates:
        return []
    topic_vec = embed_texts([topic])
    texts = [ (c.get("title","") + " " + c.get("snippet","")).strip() for c in candidates ]
    vecs = embed_texts(texts)
    sims = (topic_vec @ vecs.T).ravel().tolist()
    scored = []
    for c, s in zip(candidates, sims):
        scored.append({**c, "relevance": float(s)})
    scored.sort(key=lambda x: x["relevance"], reverse=True)
    seen = set()
    out = []
    for item in scored:
        url = item["url"]
        if not url or url in seen:
            continue
        seen.add(url)
        existing = db.query(ExternalResource).filter(ExternalResource.url == url).first()
        if not existing:
            db.add(ExternalResource(
                topic=topic[:255],
                title=item["title"][:512],
                url=url[:1024],
                source=item.get("source","web")[:128],
                snippet=item.get("snippet",""),
                relevance=item["relevance"],
                fetched_at=_now()
            ))
        out.append(item)
    db.commit()
    return out

# --------------------------------------------------------------------------------------
# SPA ROUTES (serve React)
# --------------------------------------------------------------------------------------
@app.route('/')
@app.route('/courses')
@app.route('/viewer/<slug>')
@app.route('/signup')
@app.route('/login')
@app.route('/modules/<slug>')
@app.route('/dashboard')
@app.route('/leaderboard')
def serve_react(slug=None):
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# --------------------------------------------------------------------------------------
# COURSES API
# --------------------------------------------------------------------------------------
@app.route('/api/courses')
@with_reconnect
def list_courses():
    db = SessionLocal()
    try:
        u = session.get('user')
        mine = (request.args.get('mine') == '1')

        rows = db.query(Course).all()
        items = []
        for c in rows:
            target_role = _infer_course_role_from_name(c.name)
            items.append({
                "id": c.id,
                "title": c.name,
                "description": f"Course based on {c.source_file}" if c.source_file else "",
                "slug": (c.source_file or "").replace('.json', ''),
                "target_role": target_role,
            })

        if mine and u and (u.get("job_title") or u.get("role")):
            user_role = _normalize_role(u.get("job_title") or u.get("role"))
            items = [it for it in items if it["target_role"] in (user_role, "general")]

        return jsonify(items), 200
    finally:
        db.close()

@app.route('/api/course/<slug>')
@with_reconnect
def get_course_json(slug):
    db = SessionLocal()
    try:
        if not slug.endswith(".json"):
            slug += ".json"
        course = db.query(Course).filter(Course.source_file == slug).first()
        if not course:
            return jsonify({"error": "Course not found"}), 404

        json_path = os.path.join(BASE_DIR, "static", "data", course.source_file)
        if not os.path.exists(json_path):
            return jsonify({"error": "Lesson file not found"}), 404

        with open(json_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    finally:
        db.close()

# --------------------------------------------------------------------------------------
# PDF UPLOAD → EXTRACT → BUILD COURSE
# --------------------------------------------------------------------------------------
UPLOAD_FOLDER = os.path.abspath(os.path.join(BASE_DIR, '../src/Backend/dataset pdf'))
CONTENT_FOLDER = os.path.abspath(os.path.join(BASE_DIR, '../src/Backend/content'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONTENT_FOLDER, exist_ok=True)

def extract_text_and_save(pdf_path: str) -> str:
    extracted = extract_training_from_pdf(pdf_path)
    txt_filename = os.path.basename(pdf_path).replace(".pdf", "_training.txt")
    txt_path = os.path.join(CONTENT_FOLDER, txt_filename)
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(extracted)
    return txt_path

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files allowed"}), 400

    try:
        filename = secure_filename(file.filename)
        saved_pdf_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(saved_pdf_path)
        build_course_from_pdf(saved_pdf_path)
        return jsonify({"message": "✅ Course generated successfully!"})
    except Exception as e:
        print(f"❌ Error during upload/build: {e}")
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------------------------------------------
# AUTH
# --------------------------------------------------------------------------------------
@app.route('/api/signup', methods=['POST'])
def api_signup():
    db = SessionLocal()
    try:
        data = request.get_json(force=True) or {}
        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        role = (data.get('role') or 'user').strip().lower()
        job_title = (data.get('job_title') or None) if role == 'user' else None

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required."}), 400
        if role not in ('user', 'admin'):
            return jsonify({"error": "Invalid role."}), 400
        if role == 'user' and not job_title:
            return jsonify({"error": "Please select a job title."}), 400

        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return jsonify({"error": "User already exists."}), 409

        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            job_title=job_title,
        )
        db.add(user)
        db.commit()

        session['user'] = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "job_title": user.job_title,
            "current_streak": user.current_streak or 0,
            "best_streak": user.best_streak or 0,
            "total_xp": user.total_xp or 0,
            "total_quizzes": user.total_quizzes or 0,
            "last_score": user.last_score or 0,
            "last_quiz_date": user.last_quiz_date.isoformat() if user.last_quiz_date else None,
        }
        return jsonify({"message": "Registered successfully.", "user": session['user']}), 201
    finally:
        db.close()

@app.route('/api/login', methods=['POST'])
def api_login():
    db = SessionLocal()
    try:
        data = request.get_json(force=True) or {}
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''
        role = (data.get('role') or 'user').strip().lower()

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        user = db.query(User).filter(User.email == email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password."}), 401

        if role not in ('user', 'admin'):
            return jsonify({"error": "Invalid role."}), 400
        if role and user.role != role:
            return jsonify({"error": "Role mismatch for this account."}), 403

        session['user'] = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "job_title": user.job_title,
            "current_streak": user.current_streak or 0,
            "best_streak": user.best_streak or 0,
            "total_xp": user.total_xp or 0,
            "total_quizzes": user.total_quizzes or 0,
            "last_score": user.last_score or 0,
            "last_quiz_date": user.last_quiz_date.isoformat() if user.last_quiz_date else None,
        }
        return jsonify({"message": "Logged in.", "user": session['user']}), 200
    finally:
        db.close()

@app.route('/api/me', methods=['GET'])
def api_me():
    u = session.get('user')
    return jsonify({"user": u or None}), 200

@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"message": "Logged out."}), 200

# --------------------------------------------------------------------------------------
# PROGRESS / METRICS
# --------------------------------------------------------------------------------------
def _update_streak_and_totals(user: User, score: int):
    today = date.today()
    if user.last_quiz_date is None:
        user.current_streak = 1
    else:
        delta_days = (today - user.last_quiz_date).days
        if delta_days == 0:
            pass
        elif delta_days == 1:
            user.current_streak = (user.current_streak or 0) + 1
        else:
            user.current_streak = 1

    if (user.best_streak or 0) < (user.current_streak or 0):
        user.best_streak = user.current_streak

    user.total_xp = (user.total_xp or 0) + int(score)
    user.total_quizzes = (user.total_quizzes or 0) + 1
    user.last_score = int(score)
    user.last_quiz_date = today

@app.route('/api/progress/quiz', methods=['POST'])
def api_progress_quiz():
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        payload = request.get_json(force=True) or {}
        course_slug = (payload.get('course_slug') or '').strip()
        score = int(payload.get('score') or 0)

        if not course_slug:
            return jsonify({"error": "course_slug is required."}), 400
        if score < 0:
            return jsonify({"error": "score must be >= 0."}), 400

        user = db.query(User).filter(User.id == u['id']).first()
        if not user:
            return jsonify({"error": "User not found."}), 404

        attempt = QuizAttempt(user_id=user.id, course_slug=course_slug, score=score, taken_at=datetime.utcnow())
        db.add(attempt)

        prev_total_quizzes = (user.total_quizzes or 0)
        prev_last_score = user.last_score or 0

        _update_streak_and_totals(user, score)

        new_badges = []
        if prev_total_quizzes == 0 and _award_badge(db, user.id, "FIRST_QUIZ"):
            new_badges.append("FIRST_QUIZ")
        if score >= 100 and _award_badge(db, user.id, "PERFECT_100"):
            new_badges.append("PERFECT_100")
        if user.current_streak >= 3 and _award_badge(db, user.id, "STREAK_3"):
            new_badges.append("STREAK_3")
        if user.current_streak >= 7 and _award_badge(db, user.id, "STREAK_7"):
            new_badges.append("STREAK_7")
        if prev_last_score < 50 and score >= 80 and _award_badge(db, user.id, "COMEBACK"):
            new_badges.append("COMEBACK")

        db.commit()

        session['user'].update({
            "current_streak": user.current_streak or 0,
            "best_streak": user.best_streak or 0,
            "total_xp": user.total_xp or 0,
            "total_quizzes": user.total_quizzes or 0,
            "last_score": user.last_score or 0,
            "last_quiz_date": user.last_quiz_date.isoformat() if user.last_quiz_date else None,
        })

        return jsonify({"message": "Progress saved.", "metrics": session['user'], "new_badges": new_badges}), 200
    finally:
        db.close()

@app.route('/api/me/metrics', methods=['GET'])
def api_me_metrics():
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"user": None, "metrics": None}), 200

        user = db.query(User).filter(User.id == u['id']).first()
        if not user:
            return jsonify({"user": None, "metrics": None}), 200

        metrics = {
            "name": user.name,
            "role": user.role,
            "job_title": user.job_title,
            "current_streak": user.current_streak or 0,
            "best_streak": user.best_streak or 0,
            "total_xp": user.total_xp or 0,
            "total_quizzes": user.total_quizzes or 0,
            "last_score": user.last_score or 0,
            "last_quiz_date": user.last_quiz_date.isoformat() if user.last_quiz_date else None,
        }
        return jsonify({"user": {"id": user.id, "email": user.email}, "metrics": metrics}), 200
    finally:
        db.close()

# --------------------------------------------------------------------------------------
# Daily plan / pacing endpoints
# --------------------------------------------------------------------------------------
@app.route('/api/course/<slug>/plan', methods=['GET'])
def get_daily_plan(slug):
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        filename = slug if slug.endswith('.json') else f"{slug}.json"
        course = db.query(Course).filter(Course.source_file == filename).first()
        if not course:
            return jsonify({"error": "Course not found"}), 404

        prog = _get_or_create_daily_progress(db, u['id'], course.id)
        remaining = max(0, (prog.daily_limit or 0) - (prog.lessons_completed or 0))

        lessons_q = db.query(Lesson).filter(Lesson.course_id == course.id).order_by(Lesson.position.asc())
        plan = lessons_q.offset(prog.current_position).limit(remaining).all() if remaining > 0 else []

        return jsonify({
            "course": {"id": course.id, "name": course.name, "slug": slug},
            "today": str(prog.day),
            "daily_limit": prog.daily_limit,
            "lessons_completed": prog.lessons_completed,
            "current_position": prog.current_position,
            "remaining": remaining,
            "reached_limit": remaining == 0,
            "plan": [
                {"id": l.id, "title": l.title, "position": l.position, "module_id": l.module_id}
                for l in plan
            ]
        }), 200
    finally:
        db.close()

@app.route('/api/progress/lesson', methods=['POST'])
def mark_lesson_complete():
    """
    Robust progress update:
    - Accepts either lesson_id or (zero-based) position from the client.
    - Normalizes DB lesson.position (1-based) to zero-based before comparing.
    - Advances current_position to completed_idx + 1 if it's >= current_position.
    """
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.get_json(force=True) or {}
        course_slug = (data.get('course_slug') or '').strip()
        score = int(data.get('score') or 0)
        force = bool(data.get('force') or False)

        if not course_slug:
            return jsonify({"error": "course_slug is required"}), 400

        filename = course_slug if course_slug.endswith('.json') else f"{course_slug}.json"
        course = db.query(Course).filter(Course.source_file == filename).first()
        if not course:
            return jsonify({"error": "Course not found"}), 404

        lesson = None
        lesson_id = data.get('lesson_id')
        position = data.get('position')

        if lesson_id is not None:
            lesson = db.query(Lesson).filter(and_(Lesson.id == int(lesson_id), Lesson.course_id == course.id)).first()
        elif position is not None:
            q = db.query(Lesson).filter(Lesson.course_id == course.id).order_by(Lesson.position.asc())
            lesson = q.offset(int(position)).limit(1).first()

        if not lesson and position is None:
            return jsonify({"error": "Lesson not found for this course"}), 404

        prog = _get_or_create_daily_progress(db, u['id'], course.id)

        # Respect daily cap unless force is set (front-end uses force=True)
        cap_reached = (prog.lessons_completed or 0) >= (prog.daily_limit or 0)
        if cap_reached and not force:
            remaining = max(0, (prog.daily_limit or 0) - (prog.lessons_completed or 0))
            return jsonify({
                "message": "Daily limit reached.",
                "reached_limit": True,
                "lessons_completed": prog.lessons_completed,
                "daily_limit": prog.daily_limit,
                "remaining": remaining
            }), 200

        # Normalize to zero-based completed index
        if position is not None:
            completed_idx = int(position)  # already zero-based from React
        else:
            # DB Lesson.position is 1-based from your builder; convert to zero-based
            completed_idx = max(0, (lesson.position or 1) - 1)

        # Advance only forward
        if prog.current_position is None:
            prog.current_position = 0

        if completed_idx >= prog.current_position:
            prog.current_position = completed_idx + 1

        prog.lessons_completed = (prog.lessons_completed or 0) + 1
        prog.total_score_today = (prog.total_score_today or 0) + max(0, score)
        prog.last_activity = datetime.utcnow()

        db.commit()

        remaining = max(0, (prog.daily_limit or 0) - (prog.lessons_completed or 0))
        return jsonify({
            "message": "Progress updated.",
            "reached_limit": remaining == 0,
            "today": str(prog.day),
            "daily_limit": prog.daily_limit,
            "lessons_completed": prog.lessons_completed,
            "current_position": prog.current_position,  # <-- drives module lock/unlock
            "total_score_today": prog.total_score_today,
            "remaining": remaining
        }), 200
    finally:
        db.close()

@app.route('/api/course/<slug>/plan', methods=['PUT'])
def update_daily_plan(slug):
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.get_json(force=True) or {}
        daily_limit = int(data.get('daily_limit') or 0)
        if daily_limit <= 0:
            return jsonify({"error": "daily_limit must be > 0"}), 400

        filename = slug if slug.endswith('.json') else f"{slug}.json"
        course = db.query(Course).filter(Course.source_file == filename).first()
        if not course:
            return jsonify({"error": "Course not found"}), 404

        prog = _get_or_create_daily_progress(db, u['id'], course.id)
        prog.daily_limit = daily_limit
        prog.last_activity = datetime.utcnow()
        db.commit()

        return jsonify({"message": "Updated", "daily_limit": prog.daily_limit}), 200
    finally:
        db.close()

@app.route('/api/course/<slug>/plan/summary', methods=['GET'])
def plan_summary(slug):
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        filename = slug if slug.endswith('.json') else f"{slug}.json"
        course = db.query(Course).filter(Course.source_file == filename).first()
        if not course:
            return jsonify({"error": "Course not found"}), 404

        prog = _get_or_create_daily_progress(db, u['id'], course.id)
        remaining = max(0, (prog.daily_limit or 0) - (prog.lessons_completed or 0))

        return jsonify({
            "today": str(prog.day),
            "daily_limit": prog.daily_limit,
            "lessons_completed": prog.lessons_completed,
            "remaining": remaining,
            "current_position": prog.current_position
        }), 200
    finally:
        db.close()

# --------------------------------------------------------------------------------------
# Leaderboard & Admin APIs
# --------------------------------------------------------------------------------------
@app.route('/api/leaderboard', methods=['GET'])
@with_reconnect
def leaderboard():
    db = SessionLocal()
    try:
        rows = (
            db.query(User)
            .filter(User.role == 'user')
            .order_by((User.total_xp).desc())
            .limit(20)
            .all()
        )
        return jsonify([
            {
                "id": u.id,
                "name": u.name,
                "job_title": u.job_title,
                "total_xp": u.total_xp or 0,
                "best_streak": u.best_streak or 0
            }
            for u in rows
        ]), 200
    finally:
        db.close()

@app.route('/api/admin/overview', methods=['GET'])
@require_admin
@with_reconnect
def admin_overview():
    db = SessionLocal()
    try:
        total_users = db.query(User).filter(User.role == 'user').count()
        total_courses = db.query(Course).count()
        total_quizzes = db.query(QuizAttempt).count()

        top_xp = (
            db.query(User)
            .filter(User.role == 'user')
            .order_by((User.total_xp).desc())
            .limit(5)
            .all()
        )

        return jsonify({
            "totals": {
                "users": total_users,
                "courses": total_courses,
                "quiz_attempts": total_quizzes
            },
            "top": [{"name": u.name, "xp": u.total_xp or 0} for u in top_xp]
        }), 200
    finally:
        db.close()

@app.route('/api/admin/users', methods=['GET'])
@require_admin
@with_reconnect
def admin_users():
    db = SessionLocal()
    try:
        role = request.args.get('role')
        q = db.query(User)
        if role in ('user', 'admin'):
            q = q.filter(User.role == role)
        else:
            q = q.filter(User.role == 'user')

        users = q.order_by(User.id.asc()).limit(500).all()
        return jsonify([{
            "id": u.id, "name": u.name, "email": u.email, "role": u.role,
            "job_title": u.job_title, "streak": u.current_streak or 0,
            "best_streak": u.best_streak or 0, "xp": u.total_xp or 0, "quizzes": u.total_quizzes or 0
        } for u in users]), 200
    finally:
        db.close()

@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
@require_admin
@with_reconnect
def admin_user_detail(user_id):
    db = SessionLocal()
    try:
        u = db.query(User).filter(User.id == user_id).first()
        if not u:
            return jsonify({"error": "User not found"}), 404
        attempts = (
            db.query(QuizAttempt)
            .filter(QuizAttempt.user_id == user_id)
            .order_by(QuizAttempt.taken_at.desc())
            .limit(50)
            .all()
        )
        return jsonify({
            "user": {
                "id": u.id, "name": u.name, "email": u.email, "role": u.role,
                "job_title": u.job_title, "xp": u.total_xp or 0, "streak": u.current_streak or 0,
                "best_streak": u.best_streak or 0, "quizzes": u.total_quizzes or 0
            },
            "attempts": [
                {"course_slug": a.course_slug, "score": a.score, "taken_at": a.taken_at.isoformat()}
                for a in attempts
            ]
        }), 200
    finally:
        db.close()

# -------- Topic progress (AI-normalized) --------
@app.route('/api/progress/question', methods=['POST'])
def progress_question():
    db = SessionLocal()
    try:
        u = session.get('user')
        if not u:
            return jsonify({"error": "Not authenticated"}), 401

        data = request.get_json(force=True) or {}
        qtext = (data.get('question_text') or data.get('lesson_title') or data.get('topic') or 'General').strip()
        correct = bool(data.get('correct'))

        best_label, sim = normalize_topic_from_text(qtext)
        topic = best_label if sim >= 0.35 else "General"

        row = db.query(TopicMastery).filter_by(user_id=u['id'], topic=topic).first()
        if not row:
            row = TopicMastery(user_id=u['id'], topic=topic, attempts=0, correct=0)
            db.add(row)

        prev_attempts = row.attempts or 0
        prev_correct = row.correct or 0
        prev_acc = (prev_correct / prev_attempts) if prev_attempts > 0 else None

        row.attempts = prev_attempts + 1
        if correct:
            row.correct = prev_correct + 1
        row.last_updated = datetime.utcnow()
        db.flush()

        new_acc = (row.correct / row.attempts) if row.attempts else 0.0

        new_badge = False
        if (prev_acc is not None and prev_attempts >= 5 and prev_acc < 0.50 and new_acc >= 0.80):
            if _award_badge(db, u['id'], "RETRY_MASTER"):
                new_badge = True

        db.commit()

        payload = {
            "message": "ok",
            "topic": topic,
            "attempts": row.attempts,
            "accuracy": new_acc,
            "similarity": sim,
        }
        if new_badge:
            payload["new_badge"] = "RETRY_MASTER"
        return jsonify(payload), 200
    finally:
        db.close()

# -------- Badges helpers & endpoints --------
def _award_badge(db, user_id, code):
    exists = db.query(UserBadge).filter_by(user_id=user_id, code=code).first()
    if exists:
        return False
    db.add(UserBadge(user_id=user_id, code=code))
    return True

@app.route('/api/me/badges', methods=['GET'])
def me_badges():
    u = session.get('user')
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    db = SessionLocal()
    try:
        rows = db.query(UserBadge).filter(UserBadge.user_id == u['id']).order_by(UserBadge.earned_at.desc()).all()
        return jsonify([{"code": r.code, **BADGES.get(r.code, {}), "earned_at": r.earned_at.isoformat()} for r in rows])
    finally:
        db.close()

@app.route('/api/admin/badges', methods=['GET'])
@require_admin
def admin_badges():
    db = SessionLocal()
    try:
        agg = {}
        rows = db.query(UserBadge.code, func.count(UserBadge.id)).group_by(UserBadge.code).all()
        for code, cnt in rows:
            meta = BADGES.get(code, {"name": code, "desc": ""})
            agg[code] = {"count": int(cnt), **meta}
        return jsonify(agg)
    finally:
        db.close()

# -------- AI + rules recommendations --------
@app.route('/api/recommendations', methods=['GET'])
def recommendations():
    u = session.get('user')
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == u['id']).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        weak_rows = (
            db.query(TopicMastery)
            .filter(TopicMastery.user_id == user.id)
            .filter(TopicMastery.attempts >= 3)
            .all()
        )
        weak_topics = []
        for r in weak_rows:
            acc = (r.correct / r.attempts) if r.attempts else 0.0
            if acc < 0.70:
                weak_topics.append(r.topic)

        remediate = []
        if weak_topics:
            from sqlalchemy import or_
            q = db.query(Lesson, Course).join(Course, Lesson.course_id == Course.id)
            like_clauses = [Lesson.title.ilike(f"%{t}%") for t in weak_topics]
            if like_clauses:
                q = q.filter(or_(*like_clauses))
            for l, c in q.limit(10).all():
                remediate.append({
                    "course_slug": (c.source_file or "").replace(".json", ""),
                    "course_name": c.name, "lesson_id": l.id, "lesson_title": l.title
                })

        recent = (
            db.query(QuizAttempt.course_slug)
            .filter(QuizAttempt.user_id == user.id)
            .order_by(QuizAttempt.taken_at.desc())
            .limit(10)
            .all()
        )
        recent_slugs = list({row.course_slug for row in recent})
        level_up = []
        if recent_slugs:
            for slug in recent_slugs[:3]:
                filename = slug if slug.endswith(".json") else f"{slug}.json"
                course = db.query(Course).filter(Course.source_file == filename).first()
                if not course:
                    continue
                prog = _get_or_create_daily_progress(db, user.id, course.id)
                next_lessons = (
                    db.query(Lesson)
                    .filter(Lesson.course_id == course.id)
                    .order_by(Lesson.position.asc())
                    .offset(prog.current_position or 0).limit(2).all()
                )
                for l in next_lessons:
                    level_up.append({
                        "course_slug": slug.replace(".json", ""),
                        "course_name": course.name,
                        "lesson_id": l.id, "lesson_title": l.title
                    })

        seed_texts = []
        if weak_topics:
            seed_texts += weak_topics[:5]
        for slug in recent_slugs[:5]:
            seed_texts.append(slug.replace("-", " "))
        if user.job_title and len(seed_texts) < 3:
            seed_texts.append(user.job_title)

        ai_recs = []
        if seed_texts:
            user_vec = embed_texts(seed_texts).mean(axis=0, keepdims=True)

            INDEX_DIR = os.path.join(BASE_DIR, "ai_index")
            npzs = glob.glob(os.path.join(INDEX_DIR, "*_lessons.npz"))
            for path in npzs:
                slug = os.path.basename(path).replace("_lessons.npz", "")
                meta_path = os.path.join(INDEX_DIR, f"{slug}_lessons_meta.json")
                if not os.path.exists(meta_path):
                    continue

                data = np.load(path)
                V = data["vectors"]
                sims = (user_vec @ V.T).ravel()
                top_idx = sims.argsort()[::-1][:3]
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)

                for i in top_idx:
                    m = meta[int(i)]
                    course = db.query(Course).filter(Course.id == m["course_id"]).first()
                    if not course:
                        continue
                    ai_recs.append({
                        "course_slug": (course.source_file or "").replace(".json", ""),
                        "course_name": course.name,
                        "lesson_id": m["lesson_id"],
                        "lesson_title": m["title"],
                        "score": float(sims[int(i)])
                    })

            ai_recs.sort(key=lambda x: x["score"], reverse=True)
            ai_recs = ai_recs[:9]

        role_based = []
        if user.job_title:
            role_kw = user.job_title.lower()
            courses = db.query(Course).filter(Course.name.ilike(f"%{role_kw}%")).limit(6).all()
            for c in courses:
                role_based.append({
                    "course_slug": (c.source_file or "").replace(".json", ""),
                    "course_name": c.name,
                })

        return jsonify({
            "remediate": remediate[:6],
            "level_up": level_up[:6],
            "ai_discovery": ai_recs,
            "role_based": role_based[:6],
        }), 200
    finally:
        db.close()

@app.route('/api/admin/difficulty/rebuild', methods=['POST'])
@require_admin
def rebuild_difficulty():
    db = SessionLocal()
    try:
        lessons = db.query(Lesson, Course).join(Course, Lesson.course_id==Course.id).order_by(Lesson.id.asc()).all()
        if not lessons:
            return jsonify({"message":"no lessons"}), 200

        docs = []
        meta = []
        for L, C in lessons:
            text = (L.content or "").strip()
            if (not text) and C.source_file:
                json_path = os.path.join(BASE_DIR, "static", "data", C.source_file)
                if os.path.exists(json_path):
                    try:
                        with open(json_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        arr = data if isinstance(data, list) else data.get("lessons", [])
                        found = None
                        for item in arr:
                            if (item.get("title")==L.title) or (item.get("lesson_title")==L.title):
                                found = item; break
                        text = _lesson_text(found) if found else ""
                    except Exception:
                        pass
            if not text:
                text = L.title or ""
            docs.append(text)
            meta.append((L.id, L.title or f"Lesson {L.id}"))

        scores = []
        method = "tfidf"
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            vec = TfidfVectorizer(min_df=1, max_df=0.95, ngram_range=(1,2))
            X = vec.fit_transform(docs)
            norms = (X.multiply(X)).sum(axis=1)
            scores = [float(math.sqrt(n)) for n in norms.A.ravel()]
        except Exception:
            method = "fallback"
            for text in docs:
                toks = _tokenize(text)
                T = len(toks) or 1
                unique = len(set(toks))
                ttr = unique / T
                sents = re.split(r'[.!?]+', text)
                sents = [s.strip() for s in sents if s.strip()]
                avg_sent = sum(len(_tokenize(s)) for s in sents)/max(1,len(sents))
                scores.append(0.7*ttr + 0.3*(avg_sent/30.0))

        lo, hi = min(scores), max(scores) if scores else (0.0, 1.0)
        rng = (hi - lo) or 1.0
        normalized = [ (s - lo)/rng for s in scores ]
        labels = [ _bucket_label(p) for p in normalized ]

        updated = 0
        for (lesson_id, _title), score, label in zip(meta, scores, labels):
            row = db.query(LessonDifficulty).filter(LessonDifficulty.lesson_id == lesson_id).first()
            if not row:
                row = LessonDifficulty(lesson_id=lesson_id)
                db.add(row)
            row.score = float(score)
            row.label = label
            row.method = method
            updated += 1
        db.commit()

        return jsonify({"message":"ok", "updated": updated, "method": method}), 200
    finally:
        db.close()

@app.route('/api/resources', methods=['GET'])
def api_resources():
    u = session.get('user')
    query = _clean(request.args.get("query") or request.args.get("topic") or "")
    limit = int(request.args.get("limit") or 6)
    if not query:
        return jsonify({"error": "query is required"}), 400

    db = SessionLocal()
    try:
        cached = (
            db.query(ExternalResource)
              .filter(ExternalResource.topic == query)
              .order_by(ExternalResource.relevance.desc())
              .limit(limit)
              .all()
        )
        if cached and all(_is_fresh(c.fetched_at, CACHE_TTL_MIN) for c in cached):
            return jsonify([{
                "title": c.title, "url": c.url, "snippet": c.snippet,
                "source": c.source, "relevance": c.relevance
            } for c in cached]), 200

        candidates = []
        if SERPAPI_KEY:
            candidates = _search_serpapi(query, limit=limit*2)
        if not candidates:
            candidates = _fetch_cdc_json(query, limit=limit*2)
            candidates += _fetch_rss(TRUSTED_SOURCES[1][1], limit=limit)
            candidates += _fetch_rss(TRUSTED_SOURCES[2][1], limit=limit)

        ranked = _rank_and_cache(db, query, candidates)
        return jsonify(ranked[:limit]), 200
    finally:
        db.close()

@app.route('/api/me/topics', methods=['GET'])
def me_topics():
    u = session.get('user')
    if not u:
        return jsonify({"error": "Not authenticated"}), 401
    db = SessionLocal()
    try:
        rows = (
            db.query(TopicMastery)
            .filter(TopicMastery.user_id == u['id'])
            .order_by((TopicMastery.correct * 1.0 / func.nullif(TopicMastery.attempts, 0)).asc())
            .limit(50)
            .all()
        )
        out = []
        for r in rows:
            acc = (r.correct / r.attempts) if r.attempts else 0.0
            out.append({
                "topic": r.topic,
                "attempts": r.attempts or 0,
                "correct": r.correct or 0,
                "accuracy": round(acc, 4),
                "last_updated": r.last_updated.isoformat() if r.last_updated else None,
            })
        return jsonify(out), 200
    finally:
        db.close()

# ==== Role-based course filtering helpers ====
ROLE_KEYWORDS = {
    "catering": ["food", "allergen", "kitchen", "haccp", "hygiene", "catering"],
    "nurse": ["cpr", "patient", "medication", "infection", "triage", "nurse", "clinical"],
    "cleaner": ["clean", "sanitize", "sanit", "waste", "housekeep", "janitor", "spill"],
    "general": [],
}

def _normalize_role(raw: str) -> str:
    if not raw:
        return "general"
    s = raw.strip().lower()
    if "nurs" in s: return "nurse"
    if any(k in s for k in ["cook", "cater", "kitchen", "food"]): return "catering"
    if any(k in s for k in ["clean", "janitor", "housekeep"]): return "cleaner"
    return s

def _infer_course_role_from_name(name: str) -> str:
    n = (name or "").lower()
    for role, kws in ROLE_KEYWORDS.items():
        if any(k in n for k in kws):
            return role
    return "general"

# === Chatbot (unified model) ===========================================
import openai
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # <- keep key in env ONLY


def _get_gpt_model():
    # Reuse the same model as course generation; let env override if needed
    return os.getenv("COURSE_MODEL", "gpt-3.5-turbo")

def _get_lessons_text_for_slug(db, slug: str, limit:int = 120):
    """
    Pull lesson texts for a given course slug from DB first.
    If DB lesson.content is sparse, fallback to JSON (same as /api/course/<slug>).
    Returns a list of dicts: {title, text, course_id, lesson_id}
    """
    filename = slug if slug.endswith(".json") else f"{slug}.json"
    course = db.query(Course).filter(Course.source_file == filename).first()
    if not course:
        return []

    out = []
    # 1) DB lessons (ordered)
    lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == course.id)
        .order_by(Lesson.position.asc())
        .limit(limit)
        .all()
    )

    # 2) If content missing, read from JSON file (same logic as difficulty rebuild)
    json_map = {}
    if lessons and any(not (l.content or "").strip() for l in lessons):
        json_path = os.path.join(BASE_DIR, "static", "data", course.source_file)
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                arr = data if isinstance(data, list) else data.get("lessons", [])
                # build a quick title->text map
                for item in arr:
                    t = _lesson_text(item)
                    title = (item.get("title") or item.get("lesson_title") or "").strip()
                    if title and t:
                        json_map[title] = t
            except Exception:
                pass

    for L in lessons:
        text = (L.content or "").strip()
        if not text:
            # fallback via title
            text = json_map.get(L.title or "", "")
        if not text:
            text = L.title or ""
        if not text:
            continue
        out.append({
            "title": L.title or f"Lesson {L.id}",
            "text": text,
            "course_id": L.course_id,
            "lesson_id": L.id
        })
    return out

# --- add near your other imports ---
import re
from pathlib import Path

# ... keep the rest of your app.py ...
@app.route('/api/chat/simple', methods=['POST'])
def api_chat_simple():
    """
    Healthcare training chatbot with web search fallback
    """
    try:
        u = session.get('user')
        data = request.get_json(force=True) or {}
        query = (data.get('message') or '').strip().lower()
        
        if not query:
            return jsonify({"answer": "Please ask a question about healthcare training."}), 200
        
        # Get user role for personalized responses
        user_role = "general"
        if u and u.get('job_title'):
            job_title = u.get('job_title', '').lower()
            if any(kw in job_title for kw in ["nurse", "doctor", "medical", "clinical", "healthcare", "physician"]):
                user_role = "clinical"
            elif any(kw in job_title for kw in ["cater", "food", "kitchen", "chef", "dietary"]):
                user_role = "catering"
            elif any(kw in job_title for kw in ["clean", "janitor", "housekeep", "environmental", "housekeeping"]):
                user_role = "cleaning"
        
        # Enhanced response database
        responses = {
            "general": {
                "infection control": "Infection control includes hand hygiene, PPE use, and proper disposal of medical waste.",
                "cpr": "CPR training covers chest compressions (30 compressions at 100-120 per minute), rescue breaths (2 breaths), and AED use for cardiac emergencies.",
                "fire safety": "Fire safety training includes RACE (Rescue, Alarm, Contain, Extinguish/Evacuate) and PASS (Pull, Aim, Squeeze, Sweep) for fire extinguishers.",
                "hippa": "HIPAA training covers patient privacy, data security, and proper handling of medical records.",
                "safety": "General safety training covers emergency procedures, hazard reporting, and workplace safety protocols.",
                "training": "Mandatory healthcare trainings include infection control, CPR, fire safety, and patient privacy.",
                "allergen": "The 14 major allergens are: 1. Celery 2. Cereals containing gluten 3. Crustaceans 4. Eggs 5. Fish 6. Lupin 7. Milk 8. Molluscs 9. Mustard 10. Peanuts 11. Sesame 12. Soybeans 13. Sulphur dioxide 14. Tree nuts",
                "food safety": "Food safety training includes temperature control (keep hot food above 63°C, cold food below 5°C), hygiene practices, and contamination prevention.",
                "steps of cpr": "CPR steps: 1. Check responsiveness 2. Call for help 3. Open airway 4. Check breathing 5. Start chest compressions (30 compressions) 6. Give rescue breaths (2 breaths) 7. Continue until help arrives or AED is available",
                "cross contamination": "Cross-contamination is the transfer of harmful bacteria from one surface, object or person to another. In healthcare, this often refers to the spread of pathogens between patients, staff, or equipment.",
                "emergency": "In case of emergency, follow your facility's emergency protocols. Generally: 1. Ensure your safety 2. Assess the situation 3. Call for help 4. Provide appropriate care within your training limits",
                "ppe": "Personal Protective Equipment (PPE) includes gloves, masks, gowns, goggles, and face shields to protect against infection transmission.",
            },
            "clinical": {
                "infection control": "For clinical staff, infection control includes sterile techniques, isolation precautions, proper disposal of sharps, and hand hygiene before and after patient contact.",
                "cpr": "Clinical CPR includes advanced life support techniques, team response coordination, and use of advanced airway management and medications.",
                "patient safety": "Patient safety covers medication administration (right patient, drug, dose, route, time), fall prevention, and proper patient identification using two identifiers.",
                "documentation": "Proper clinical documentation includes accurate charting, medication records, treatment notes, and incident reporting.",
                "medication": "Medication safety includes the five rights: right patient, right drug, right dose, right route, right time.",
            },
            "catering": {
                "allergen": "For catering staff, the 14 major allergens must be clearly labeled. Cross-contamination prevention includes separate preparation areas, utensils, and storage. Always ask about dietary requirements.",
                "food safety": "Food safety for catering includes HACCP principles, temperature monitoring (keep hot food above 63°C, cold food below 5°C), and hygiene practices including regular hand washing.",
                "hygiene": "Personal hygiene for food handlers includes thorough hand washing, clean uniforms, hair restraints, and reporting illness immediately.",
                "cross contamination": "Prevent cross-contamination by: 1. Using separate equipment for different foods 2. Cleaning surfaces thoroughly 3. Storing raw and cooked foods separately 4. Washing hands between tasks",
                "milk allergen": "Yes, milk is one of the 14 major allergens and must be clearly labeled on all food products.",
            },
            "cleaning": {
                "infection control": "For cleaning staff, infection control includes proper disinfection techniques (using appropriate chemicals and contact times), waste disposal, and PPE usage including gloves and aprons.",
                "chemical safety": "Chemical safety training includes proper dilution, storage, handling of cleaning products, and understanding COSHH (Control of Substances Hazardous to Health) regulations.",
                "waste disposal": "Medical waste disposal training includes segregation (clinical, offensive, domestic), containment, and proper disposal procedures following color-coded bags system.",
                "blood spillage": "For blood spillage: 1. Wear appropriate PPE 2. Contain the spill 3. Use appropriate disinfectant 4. Clean from the outside inward 5. Dispose of materials correctly",
            }
        }
        
        # First, check for exact phrase matches
        answer = None
        for keyword, response in responses[user_role].items():
            if keyword in query:
                answer = response
                break
                
        # If no match in role-specific, check general responses
        if not answer:
            for keyword, response in responses["general"].items():
                if keyword in query:
                    answer = response
                    break
        
        # If still no match, search trusted healthcare sources
        if not answer:
            answer = search_healthcare_sources(query)
        
        return jsonify({"answer": answer}), 200
        
    except Exception as e:
        print("Simple chat error:", str(e))
        return jsonify({"answer": "I'm having trouble responding right now. Please try again."}), 200

def search_healthcare_sources(query):
    """
    Search trusted healthcare sources for information
    """
    try:
        # Try CDC API first
        cdc_results = _fetch_cdc_json(query, limit=1)
        if cdc_results:
            return f"Based on CDC guidelines: {cdc_results[0].get('snippet', '')}"
        
        # Try WHO RSS
        who_results = _fetch_rss(TRUSTED_SOURCES[1][1], limit=3)
        if who_results:
            for result in who_results:
                if any(term in result.get('title', '').lower() or term in result.get('snippet', '').lower() 
                       for term in query.split()):
                    return f"According to WHO: {result.get('snippet', '')}"
        
        # Try NHS RSS
        nhs_results = _fetch_rss(TRUSTED_SOURCES[2][1], limit=3)
        if nhs_results:
            for result in nhs_results:
                if any(term in result.get('title', '').lower() or term in result.get('snippet', '').lower() 
                       for term in query.split()):
                    return f"According to NHS: {result.get('snippet', '')}"
        
        # If nothing found in trusted sources, provide a general response
        return "I can help with questions about mandatory healthcare trainings like infection control, CPR, fire safety, and patient privacy. Could you be more specific about what you'd like to know?"
        
    except Exception as e:
        print("Healthcare source search error:", str(e))
        return "I'm having trouble accessing healthcare information sources right now. Please try again later."
    

@app.route('/api/admin/analytics', methods=['GET'])
@require_admin
@with_reconnect
def admin_analytics():
    """
    Live analytics for AdminDashboard.
    """
    db = SessionLocal()
    try:
        # ----- user engagement (last 14 days) -----
        today = date.today()
        start = today - timedelta(days=13)

        # quiz attempts per day
        qa_rows = (
            db.query(func.date(QuizAttempt.taken_at), func.count(QuizAttempt.id))
            .filter(QuizAttempt.taken_at >= datetime.combine(start, datetime.min.time()))
            .group_by(func.date(QuizAttempt.taken_at))
            .all()
        )
        qa_map = {str(d): int(c) for d, c in qa_rows}

        # active users per day (any quiz attempt or plan activity)
        act_rows = (
            db.query(func.date(QuizAttempt.taken_at), func.count(func.distinct(QuizAttempt.user_id)))
            .filter(QuizAttempt.taken_at >= datetime.combine(start, datetime.min.time()))
            .group_by(func.date(QuizAttempt.taken_at))
            .all()
        )
        act_map = {str(d): int(c) for d, c in act_rows}

        # fill 14-day series
        user_engagement = []
        for i in range(14):
            d = (start + timedelta(days=i))
            key = str(d)
            user_engagement.append({
                "date": d.strftime("%Y-%m-%d"),
                "active_users": act_map.get(key, 0),
                "quiz_attempts": qa_map.get(key, 0),
            })

        # ----- course progress -----
        courses = db.query(Course).all()
        course_progress = []
        total_users = db.query(User).filter(User.role == 'user').count()

        # lessons count per course
        lessons_per_course = {
            c.id: db.query(Lesson).filter(Lesson.course_id == c.id).count()
            for c in courses
        }

        # aggregate progress per course
        for c in courses:
            lesson_count = lessons_per_course.get(c.id, 0) or 1  # avoid /0
            # users who have a progress row for this course
            prog_rows = db.query(UserCourseProgress).filter(UserCourseProgress.course_id == c.id).all()
            in_progress = sum(1 for p in prog_rows if (p.current_position or 0) > 0)
            completed = sum(1 for p in prog_rows if (p.current_position or 0) >= lesson_count)
            course_progress.append({
                "course_id": c.id,
                "course_name": c.name,
                "total_users": total_users,
                "in_progress": in_progress,
                "completed": completed,
            })

        # ----- job distribution -----
        job_rows = (
            db.query(User.job_title, func.count(User.id))
            .filter(User.role == 'user')
            .group_by(User.job_title)
            .all()
        )
        job_distribution = [{"job_title": jt or "Not specified", "count": int(cnt)} for jt, cnt in job_rows]

        # ----- summary metrics -----
        # average completion rate across all existing progress rows
        all_prog = db.query(UserCourseProgress).all()
        ratio_sum, ratio_cnt = 0.0, 0
        for p in all_prog:
            lesson_count = lessons_per_course.get(p.course_id, 0)
            if lesson_count > 0:
                ratio_sum += min((p.current_position or 0) / lesson_count, 1.0)
                ratio_cnt += 1
        avg_completion_rate = (ratio_sum / ratio_cnt) if ratio_cnt else None

        # average quiz score (last 30 days)
        since = datetime.utcnow() - timedelta(days=30)
        quiz_rows = db.query(QuizAttempt.score).filter(QuizAttempt.taken_at >= since).all()
        avg_quiz_score = (sum(r[0] for r in quiz_rows) / len(quiz_rows)) if quiz_rows else None

        # active this week (distinct users with attempts or plan activity)
        week_since = datetime.utcnow() - timedelta(days=7)
        active_attempt = db.query(func.distinct(QuizAttempt.user_id)).filter(QuizAttempt.taken_at >= week_since).all()
        active_attempt_ids = {r[0] for r in active_attempt}
        active_this_week = len(active_attempt_ids)

        return jsonify({
            "user_engagement": user_engagement,
            "course_progress": course_progress,
            "job_distribution": job_distribution,
            "avg_completion_rate": avg_completion_rate,
            "avg_quiz_score": avg_quiz_score,
            "active_this_week": active_this_week,
        }), 200
    finally:
        db.close()

@app.post("/api/normalize-topic")
def api_normalize_topic():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text is required"}), 400
    label, score = normalize_topic_from_text(text)
    return jsonify({"label": label, "score": float(score)})

if __name__ == '__main__':
    app.run(debug=True)
