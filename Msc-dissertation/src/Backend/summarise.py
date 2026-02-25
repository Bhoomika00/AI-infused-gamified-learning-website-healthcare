import sys
import os

# Add the project root directory to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..','frontend')))

# importing the models
from models import Base, Course, Module, Lesson, Question


import openai
import json
import re
import traceback
import PyPDF2
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

#   Configuration 
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") 
DB_PATH = "mysql+pymysql://root:root123@localhost/healthcare_db"
engine = create_engine(DB_PATH)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
session = Session()

#   PDF Text Extractor  
def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file"""
    text = ""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

#   Detect Course Topic  
def detect_course_topic(text):
    """Automatically detect the course topic from PDF content"""
    # Look for common patterns in document titles
    patterns = [
        r"(?:Standard|Policy|Guideline|Procedure|Manual)\s+for\s+(.+?)(?:\s+Policy|\s+Guideline|$)",
        r"(?:Training|Course|Education)\s+on\s+(.+?)(?:\s+for|$)",
        r"(.+?)\s+(?:Policy|Procedure|Guideline|Manual)",
    ]
    
    # Check the first few lines for a title
    lines = text.split('\n')
    for line in lines[:10]:  # Check first 10 lines
        line = line.strip()
        if not line:
            continue
            
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).strip()
    
    # If no pattern matched, use AI to detect the topic
    prompt = f"Based on the following text, what is the main topic of this document? Respond with just the topic name in 2-5 words.\n\nText: {text[:1000]}"
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return response['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"Error detecting topic: {e}")
        return "Professional Training"

#   Filter out table of contents and other non-content sections  
def filter_non_content(text):
    """Remove table of contents, headers, footers, and other non-content elements"""
    # Remove table of contents (lines with page numbers)
    lines = text.split('\n')
    filtered_lines = []
    
    # Patterns to identify TOC lines
    toc_patterns = [
        r'\.\.\.\s*\d+$',  # Lines ending with ... and a page number
        r'\.\s*\d+$',      # Lines ending with . and a page number
        r'^\d+\s+\.\.\.',  # Lines starting with number and ...
        r'^Contents$',     # Just the word "Contents"
        r'^Table of Contents$',  # Table of Contents heading
    ]
    
    in_toc = False
    for line in lines:
        line = line.strip()
        
        # Check if we're entering TOC
        if any(re.search(pattern, line, re.IGNORECASE) for pattern in [r'contents', r'table of contents']):
            in_toc = True
            continue
        
        # Check if we're exiting TOC (when we hit the first section)
        if in_toc and re.match(r'^\d+\.\s+[A-Z]', line):
            in_toc = False
        
        # Skip TOC lines and page headers/footers
        if in_toc:
            continue
            
        # Skip lines that are likely page numbers or headers
        if (re.match(r'^\d+$', line) or  # Just a number (page number)
            re.match(r'^Page \d+ of \d+$', line) or  # Page X of Y
            re.match(r'^[A-Z][A-Z\s]+$', line) or  # All caps (likely header)
            len(line) < 5 and not any(c.isalpha() for c in line)):  # Very short lines without letters
            continue
            
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)

#spliting secrions by headings
def split_sections_by_headings(text):
    """Split text into sections based on headings with better content grouping"""
    # Patterns to catch various heading formats
    patterns = [
        r"(?:^|\n)(\d+(?:\.\d+)*\s+[A-Z][^\n]+)(?=\n|$)",  # Numbered headings (1. Introduction)
        r"(?:^|\n)([A-Z][A-Za-z\s]{10,}[:]?)(?=\n|$)",     # Title case headings (longer ones)
        r"(?:^|\n)(Appendix\s+\d+\s*[-–]?\s*.+?)(?=\n|$)", # Appendix headings
    ]
    
    sections = []
    current_heading = "Introduction"
    current_content = []
    
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        is_heading = False
        for pattern in patterns:
            if re.match(pattern, line):
                is_heading = True
                break
                
        if is_heading:
            # Save previous section only if it has substantial content
            if current_content and len(' '.join(current_content)) > 300:  # Increased minimum content length
                sections.append((current_heading, ' '.join(current_content)))
            
            # Start new section
            current_heading = line
            current_content = []
        else:
            current_content.append(line)
    
    # Add the last section
    if current_content and len(' '.join(current_content)) > 300:
        sections.append((current_heading, ' '.join(current_content)))
    
    return sections

#   Improve Generic Titles  
def smarten_title(original_title, section_text):
    """Improve section titles using AI"""
    if len(original_title.split()) > 4 or re.search(r'[A-Z].+[a-z]', original_title):
        return original_title

    prompt = f"""You are renaming section titles for a training course to make them clearer and more engaging.

Original title: \"{original_title}\"
Section content (excerpt): \"{section_text[:400]}\"

Provide a concise, human-readable, engaging new title that reflects the topic. Return only the title, no other text."""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return response['choices'][0]['message']['content'].strip().strip('"')
    except Exception as e:
        print(f"Error generating title: {e}")
        return original_title

#   AI: Module Name Generator  
def generate_module_name(section_headings, section_texts):
    """Generate module name based on multiple sections"""
    system_prompt = (
        "You are an AI assistant organizing an e-learning course. "
        "Return a short, reusable module name (3-5 words max) that groups similar content under a clear theme."
    )

    user_prompt = "Group these sections under a common theme:\n"
    for i, (heading, text) in enumerate(zip(section_headings, section_texts)):
        user_prompt += f"{i+1}. {heading}\n"
    
    user_prompt += f"\nContent sample: {section_texts[0][:500]}..."

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.4
        )
        return response['choices'][0]['message']['content'].strip().strip('"')
    except Exception as e:
        print(f"Error generating module name: {e}")
        return "General Module"

#AI: Lesson + Quiz Generator
def generate_lesson_and_questions(section_heading, section_text, course_topic):
    """Generate lesson content and questions with explanations"""
    # Clean the section heading to remove section numbers
    cleaned_heading = re.sub(r'^\d+(\.\d+)*\s+', '', section_heading)
    
    system_prompt = (
        f"You are an AI assistant helping design training courses for {course_topic}. "
        "Write comprehensive, detailed lessons with 10-15 sentences. Make quizzes educational, fair, and scenario-relevant. "
        "For each question, include an 'explanation' field that explains why the correct answer is right "
        "and why wrong answers are incorrect. This will help learners understand their mistakes."
    )

    user_prompt = f"""
You are creating a detailed lesson about: \"{cleaned_heading}\"

Do the following:
1. Write a comprehensive, detailed lesson summary (10-15 sentences) that directly addresses the topic. 
   Provide thorough explanations, examples, and practical applications.
   Avoid phrases like "This section discusses..." or "In section X.Y.Z...". Start directly with the content.
2. Generate 3 to 5 quiz questions with these requirements:
   - Mix of question types: MCQ (with 3-4 options), True/False, Scenario-based
   - All questions must have options
   - For each question, include an 'explanation' field that explains why the correct answer is right
     and provides hints for wrong answers

Return this JSON format:
{{
  "lesson_title": "...",
  "lesson_summary": "...",
  "questions": [
    {{
      "type": "mcq|true_false|match|scenario",
      "question": "...",
      "options": ["...", "..."],
      "answer": "...",
      "explanation": "Explanation of why the correct answer is right and hints for wrong answers..."
    }}
  ]
}}

Content to base the lesson on:
{section_text[:4000]}  
"""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.5
        )
        raw_output = response['choices'][0]['message']['content'].strip()
        
        # Clean the response
        if "```json" in raw_output:
            raw_output = raw_output.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_output:
            raw_output = raw_output.split("```")[1].strip()
            
        print(" Raw GPT Output:\n", raw_output[:500])
        
        if not raw_output.startswith("{"):
            raise ValueError("GPT response is not valid JSON:\n" + raw_output)

        return json.loads(raw_output)
    except Exception as e:
        print(f"Error generating lesson: {e}")
        # Return a default structure if generation fails
        return {
            "lesson_title": cleaned_heading,
            "lesson_summary": f"This comprehensive lesson covers {cleaned_heading} in detail.",
            "questions": [
                {
                    "type": "mcq",
                    "question": f"What is the main topic of {cleaned_heading}?",
                    "options": ["Option 1", "Option 2", "Option 3"],
                    "answer": "Option 1",
                    "explanation": "This is the correct answer because... For wrong answers, consider reviewing the section on..."
                }
            ]
        }

#   Group sections into modules  
def group_sections_into_modules(sections, max_lessons_per_module=5):
    """Group sections into modules with a maximum number of lessons"""
    modules = []
    current_module = []
    
    for section in sections:
        if len(current_module) >= max_lessons_per_module:
            modules.append(current_module)
            current_module = []
        current_module.append(section)
    
    if current_module:
        modules.append(current_module)
    
    return modules

#   Main Course Builder  
def build_course_from_pdf(pdf_path):
    """Main function to build course from PDF"""
    # Extract text from PDF
    print(" Extracting text from PDF...")
    text = extract_text_from_pdf(pdf_path)
    if not text:
        print(" Failed to extract text from PDF")
        return
    
    # Detect course topic
    print(" Detecting course topic...")
    course_topic = detect_course_topic(text)
    print(f"Detected topic: {course_topic}")
    
    # Filter out non-content sections like TOC
    print("Filtering out non-content sections...")
    text = filter_non_content(text)
    
    # Split into sections
    print("Splitting into sections...")
    sections = split_sections_by_headings(text)
    print(f"Detected {len(sections)} sections")
    
    if not sections:
        print("No valid sections found after filtering")
        return
    
    # Group sections into modules (max 5 lessons per module)
    module_groups = group_sections_into_modules(sections, max_lessons_per_module=5)
    print(f"Created {len(module_groups)} modules")
    
    # Create course name from PDF filename
    course_name = os.path.basename(pdf_path).replace(".pdf", "").replace("_", " ").title()
    json_filename = os.path.basename(pdf_path).replace(".pdf", ".json")
    
    # Check if course already exists
    course_obj = session.query(Course).filter_by(name=course_name).first()
    if not course_obj:
        course_obj = Course(name=course_name, source_file=json_filename)
        session.add(course_obj)
        session.flush()
    
    all_data = []
    global_lesson_position = 0
    
    # Process each module group
    for module_index, module_sections in enumerate(module_groups):
        headings = [h for h, c in module_sections]
        contents = [c for h, c in module_sections]
        
        # Generate module name
        module_name = generate_module_name(headings, contents)
        print(f" Processing module {module_index+1}: {module_name}")
        
        # Create module in database
        module_obj = Module(name=module_name, course_id=course_obj.id)
        session.add(module_obj)
        session.flush()
        
        # Process each section in the module
        for section_index, (heading, content) in enumerate(module_sections):
            global_lesson_position += 1
            print(f"   Processing section: {heading[:50]}...")
            
            try:
                # Improve title if needed
                smarter_heading = smarten_title(heading, content)
                
                # Generate lesson and questions
                data = generate_lesson_and_questions(smarter_heading, content, course_topic)
                
                # Create lesson in database
                lesson_obj = Lesson(
                    title=data['lesson_title'],
                    content=data['lesson_summary'],
                    course_id=course_obj.id,
                    module_id=module_obj.id,  # This is the key fix - using the current module_obj.id
                    position=global_lesson_position
                )
                session.add(lesson_obj)
                session.flush()
                
                # Create questions in database
                for q in data['questions']:
                    if 'options' not in q or not q['options']:
                        print(f" Skipping question due to missing options: {q['question']}")
                        continue
                    
                    question = Question(
                        lesson_id=lesson_obj.id,
                        type=q['type'],
                        question_text=q['question'],
                        options=json.dumps(q.get('options')) if 'options' in q else None,
                        answer=json.dumps(q['answer']) if isinstance(q['answer'], (dict, list)) else str(q['answer']),
                        explanation=q.get('explanation', 'No explanation provided.')
                    )
                    session.add(question)
                
                all_data.append(data)
                
            except Exception as e:
                print(f" Error in section '{heading}': {e}")
                traceback.print_exc()
    
    # Commit all changes to database
    session.commit()
    
    # Export JSON for frontend
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'static', 'data'))
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, json_filename)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2)
    print(f"Exported: {output_path}")
    
    return all_data

# Run from CLI  
if __name__ == "__main__":
    file_path = input("Enter the path to your PDF file: ").strip()
    
    if not os.path.exists(file_path):
        print(" File not found.")
    else:
        build_course_from_pdf(file_path)