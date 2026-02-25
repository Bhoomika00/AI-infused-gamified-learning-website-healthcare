##optional/backup file

import openai
import os
import json
import re
import traceback
from sqlalchemy import Column, Integer, String, Text, ForeignKey, create_engine
from sqlalchemy.orm import relationship, declarative_base, sessionmaker

#   CONFIG  
openai.api_key = os.getenv("OPENAI_API_KEY")
Base = declarative_base()

# Use MySQL only
DB_PATH = "mysql+pymysql://root:root123@localhost/healthcare_db"

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

    lesson = relationship("Lesson", back_populates="questions")

#   SETUP DB  
engine = create_engine(DB_PATH)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

#   UTILS  
def split_sections_by_headings(text):
    sections = []
    chunks = text.split("Learning Points:")
    for i, chunk in enumerate(chunks):
        cleaned = chunk.strip()
        if len(cleaned) > 100:
            heading = f"Section {i+1}"
            sections.append((heading, cleaned))

    if not sections:
        pattern = re.compile(r'^(\d+(\.\d+)*\s+[^\n]+)', re.MULTILINE)
        matches = list(pattern.finditer(text))
        for i in range(len(matches)):
            start = matches[i].start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            heading = matches[i].group(0).strip()
            content = text[start:end].strip()
            sections.append((heading, content))

    return sections

def generate_module_name(section_heading, section_text):
    system_prompt = (
        "You are an AI assistant organizing an e-learning course. "
        "Given a training section, return a short and reusable module name that it belongs to. "
        "The module should be able to group similar lessons under a clear theme. "
        "Avoid repeating the heading, and avoid generic names like 'Introduction' unless absolutely necessary. "
        "Output only the module name (5–7 words max)."
    )

    user_prompt = f"""Section Title:
{section_heading}

Section Content:
{section_text[:1000]}
"""

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.5
    )
    return response['choices'][0]['message']['content'].strip()

def generate_lesson_and_questions(section_heading, section_text):
    system_prompt = "You are an AI assistant helping design a generic training course for e-learning platforms."
    user_prompt = f"""
You are given a section of training content titled: \"{section_heading}\".

Please do the following:
1. Convert the section into a clear, concise course lesson summary (3–5 sentences).
2. Create 3 to 6 quiz questions based on the content.
   - Mix types: MCQ, true/false, match pairs, scenario-based.
   - Provide answer options if needed.

Return the response in this JSON format:
{{
  \"lesson_title\": \"...\",
  \"lesson_summary\": \"...\",
  \"questions\": [
    {{
      \"type\": \"mcq|true_false|match|scenario\",
      \"question\": \"...\",
      \"options\": [\"...\", \"...\"],
      \"answer\": \"...\"
    }}
  ]
}}

Section Content:
{section_text}
"""
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.4
    )
    raw_output = response['choices'][0]['message']['content']
    print("🔍 Raw GPT Output:\n", raw_output[:1000])
    return json.loads(raw_output)

#   MAIN PIPELINE  
def build_course_from_structured_text(summary_file_path):
    with open(summary_file_path, 'r', encoding='utf-8') as f:
        full_text = f.read()

    sections = split_sections_by_headings(full_text)
    print(f"✅ Detected {len(sections)} sections")
    all_data = []

    course_name = os.path.basename(summary_file_path).replace("_training.txt", "").replace("_", " ").title()
    course_obj = session.query(Course).filter_by(name=course_name).first()
    if not course_obj:
        course_obj = Course(name=course_name, source_file=os.path.basename(summary_file_path))
        session.add(course_obj)
        session.flush()

    module_cache = {}

    for heading, content in sections:
        print(f"\n🧠 Processing: {heading}\n")
        try:
            module_name = generate_module_name(heading, content)
            print(f"📚 Module Detected: {module_name}")
            if module_name not in module_cache:
                module_obj = Module(name=module_name, course_id=course_obj.id)
                session.add(module_obj)
                session.flush()
                module_cache[module_name] = module_obj
            else:
                module_obj = module_cache[module_name]

            data = generate_lesson_and_questions(heading, content)

            lesson_obj = Lesson(
                title=data['lesson_title'],
                content=data['lesson_summary'],
                course_id=course_obj.id,
                module_id=module_obj.id
            )
            session.add(lesson_obj)
            session.flush()

            for q in data['questions']:
                question = Question(
                    lesson_id=lesson_obj.id,
                    type=q['type'],
                    question_text=q['question'],
                    options=json.dumps(q.get('options')) if 'options' in q else None,
                    answer=json.dumps(q['answer']) if isinstance(q['answer'], (dict, list)) else q['answer']
                )
                session.add(question)

            all_data.append(data)
        except Exception as e:
            print(f"❌ Failed to process section '{heading}': {e}")
            traceback.print_exc()

    session.commit()

    output_path = summary_file_path.replace(".txt", "_grouped_course.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2)
    print(f"\n✅ Course saved to DB and exported as JSON: {output_path}")

#   Console Entry  
if __name__ == "__main__":
    file_path = input("Enter the path to your structured training .txt file: ").strip()
    if not os.path.exists(file_path):
        print("❌ File not found.")
    else:
        build_course_from_structured_text(file_path)
