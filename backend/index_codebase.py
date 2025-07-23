# backend/index_codebase.py
import os
from embed import add_document

ALLOWED_EXTENSIONS = [".py", ".ts", ".js", ".jsx", ".tsx", ".json", ".html", ".css"]
EXCLUDE_DIRS = [".git", "__pycache__", "node_modules", ".venv"]

REPO_BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))

def is_valid_file(file_path):
    return os.path.splitext(file_path)[1] in ALLOWED_EXTENSIONS

def chunk_text(text, max_chunk_size=3000):
    # chunk by characters (~750 tokens conservatively)
    chunks = []
    start = 0
    length = len(text)
    while start < length:
        end = start + max_chunk_size

        if end < length:
            # try to break at newline before max_chunk_size
            newline_pos = text.rfind('\n', start, end)
            if newline_pos != -1 and newline_pos > start:
                end = newline_pos + 1

        chunks.append(text[start:end])
        start = end
    return chunks

def walk_and_index():
    for repo_name in os.listdir(REPO_BASE_PATH):
        repo_path = os.path.join(REPO_BASE_PATH, repo_name)
        if not os.path.isdir(repo_path):
            continue

        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                file_path = os.path.join(root, file)
                if is_valid_file(file_path):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            tag_base = f"[{repo_name}] {os.path.relpath(file_path, repo_path)}"

                            chunks = chunk_text(content)
                            for i, chunk in enumerate(chunks):
                                tag = f"{tag_base} (chunk {i + 1}/{len(chunks)})"
                                add_document(chunk, tag)
                            print(f"✅ Indexed: {tag_base} in {len(chunks)} chunks")
                    except Exception as e:
                        print(f"⚠️ Skipped {file_path}: {str(e)}")

if __name__ == "__main__":
    walk_and_index()
