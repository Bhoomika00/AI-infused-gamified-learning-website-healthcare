from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.types import Date as SA_Date, DateTime as SA_DateTime
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, date
from sqlalchemy import Column, Integer, Float, String, ForeignKey, UniqueConstraint
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Index
from datetime import datetime

Base = declarative_base()

#   DATABASE MODELS  
class Course(Base):
    __tablename__ = 'courses'
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    source_file = Column(String(255))
    lessons = relationship("Lesson", back_populates="course")
    modules = relationship("Module", back_populates="course")

class Module(Base):
    __tablename__ = 'modules'
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    course_id = Column(Integer, ForeignKey('courses.id'))
    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module")

class Lesson(Base):
    __tablename__ = 'lessons'
    id = Column(Integer, primary_key=True)
    title = Column(String(255))
    content = Column(Text)
    course_id = Column(Integer, ForeignKey('courses.id'))
    module_id = Column(Integer, ForeignKey('modules.id'))
    position = Column(Integer, default=0, index=True)  # order within course
    questions = relationship("Question", back_populates="lesson")
    course = relationship("Course", back_populates="lessons")
    module = relationship("Module", back_populates="lessons")

class Question(Base):
    __tablename__ = 'questions'
    id = Column(Integer, primary_key=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'))
    type = Column(String(50))
    question_text = Column(Text)
    options = Column(Text, nullable=True)
    answer = Column(Text)
    explanation=Column(Text)
    lesson = relationship("Lesson", back_populates="questions")

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default='user')       # 'user' | 'admin'
    job_title = Column(String(50), nullable=True)

    current_streak = Column(Integer, default=0)
    best_streak    = Column(Integer, default=0)
    last_quiz_date = Column(SA_Date, nullable=True)      # <-- SQLAlchemy Date type
    total_xp       = Column(Integer, default=0)
    total_quizzes  = Column(Integer, default=0)
    last_score     = Column(Integer, default=0)

class QuizAttempt(Base):
    __tablename__ = 'quiz_attempts'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=False)
    course_slug = Column(String(255), index=True, nullable=False)
    score = Column(Integer, nullable=False)
    taken_at = Column(SA_DateTime, default=datetime.utcnow)  # <-- SQLAlchemy DateTime type

class UserCourseProgress(Base):
    __tablename__ = 'user_course_progress'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), index=True, nullable=False)

    day = Column(SA_Date, default=date.today, index=True)        # <-- use Python date.today
    daily_limit = Column(Integer, default=5)                      # lessons/day target
    lessons_completed = Column(Integer, default=0)
    total_score_today = Column(Integer, default=0)

    # pointer to where the learner is (zero-based position in the course)
    current_position = Column(Integer, default=0)

    last_activity = Column(SA_DateTime, default=datetime.utcnow, index=True)

class TopicMastery(Base):
    __tablename__ = 'topic_mastery'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=False)
    topic = Column(String(255), nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    correct = Column(Integer, default=0, nullable=False)
    last_updated = Column(SA_DateTime, default=datetime.utcnow, nullable=False)

class UserBadge(Base):
    __tablename__ = 'user_badges'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), index=True, nullable=False)
    code = Column(String(50), index=True, nullable=False)     # e.g., "FIRST_QUIZ"
    earned_at = Column(SA_DateTime, default=datetime.utcnow, nullable=False)




class LessonDifficulty(Base):
    __tablename__ = 'lesson_difficulty'
    id = Column(Integer, primary_key=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'), index=True, nullable=False, unique=True)
    score = Column(Float, default=0.0)             # continuous difficulty score
    label = Column(String(20), default='medium')    # 'easy' | 'medium' | 'hard'
    method = Column(String(20), default='tfidf')    # 'tfidf' | 'fallback'



class ExternalResource(Base):
    __tablename__ = "external_resources"

    id = Column(Integer, primary_key=True)
    topic = Column(String(255))
    title = Column(String(512))
    url = Column(String(191), unique=True, nullable=False)
    source = Column(String(128))
    snippet = Column(Text)
    relevance = Column(Float)
    fetched_at = Column(DateTime, default=datetime.utcnow)


Index('idx_ext_topic_relevance', ExternalResource.topic, ExternalResource.relevance.desc())
 