# backend/index_codebase.py
import os
from embed import add_document

ALLOWED_EXTENSIONS = [".py", ".ts", ".js", ".jsx", ".tsx", ".json", ".html", ".css"]
EXCLUDE_DIRS = [".git", "__pycache__", "node_modules", ".venv"]

REPO_BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))

def is_valid_file(file_path):
    return os.path.splitext(file_path)[1] in ALLOWED_EXTENSIONS

def walk_and_index():
    for repo_name in os.listdir(REPO_BASE_PATH):
        repo_path = os.path.join(REPO_BASE_PATH, repo_name)
        if not os.path.isdir(repo_path):
            continue

        for root, dirs, files in os.walk(repo_path):
            # Skip unwanted directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in files:
                file_path = os.path.join(root, file)
                if is_valid_file(file_path):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            tag = f"[{repo_name}] {os.path.relpath(file_path, repo_path)}"
                            add_document(content, tag)
                            print(f"✅ Indexed: {tag}")
                    except Exception as e:
                        print(f"⚠️ Skipped {file_path}: {str(e)}")

if __name__ == "__main__":
    walk_and_index()
