import os
import fitz  # PyMuPDF
import re

# Utility to remove unwanted lines like footers, metadata
def is_useless_line(text):
    patterns = [
        r"^Ref:", r"^Ratified date:", r"^Last amended:", r"^Page\s+\d+\s+of\s+\d+",
        r"^Title:", r"^Status:", r"^Document type:", r"^Overarching Policy:",
        r"^HS-\d{4}-\d{3}-v\d+\.\d+", r"^FOI Clause", r"^Required information type", r"^Appendix",
        r"^Change record", r"^Next review date", r"^An equality analysis", r"^This document was approved"
    ]
    return any(re.match(p, text.strip()) for p in patterns)

# Main extractor logic
def extract_training_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    full_text = ""

    skipping_contents = False
    started_main_content = False

    for page in doc:
        blocks = page.get_text("blocks")
        blocks.sort(key=lambda b: b[1])  # sort by vertical y position

        for block in blocks:
            line = block[4].strip()
            if not line:
                continue
            if is_useless_line(line):
                continue

            if "Contents" in line and not started_main_content:
                skipping_contents = True
                continue
            if skipping_contents and re.match(r"^\d+(\.\d+)*\s", line):
                skipping_contents = False
                started_main_content = True

            if skipping_contents:
                continue

            # === Section Headings Detection ===
            if (
                re.match(r"^\d+(\.\d+)*\s", line) or
                (line.isupper() and len(line.split()) <= 10) or
                line.startswith("###")
            ):
                full_text += f"\n\n### {line.strip()}\n"
            else:
                full_text += line.strip() + " "

    return full_text

#  Reusable from Flask backend upload logic
def extract_text_and_save(pdf_path):
    try:
        content = extract_training_from_pdf(pdf_path)
        filename = os.path.basename(pdf_path).replace(".pdf", "").lower().replace(" ", "_")
        output_folder = os.path.join("content")
        os.makedirs(output_folder, exist_ok=True)
        output_path = os.path.join(output_folder, f"{filename}_training.txt")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f" Saved extracted content to: {output_path}")
        return output_path

    except Exception as e:
        print(f" Error in extract_text_and_save: {e}")
        raise e

# 🔧 CLI utility for testing
def main():
    pdf_path = input("Enter the path to your PDF file: ").strip()

    if not os.path.exists(pdf_path):
        print(" File not found. Please check the path and try again.")
        return

    print("\nExtracting training content...\n")
    extract_text_and_save(pdf_path)

if __name__ == "__main__":
    main()


