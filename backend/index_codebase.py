# backend/index_codebase.py
import os
from embed import add_document
from typing import Optional, List

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

def index_single_repository(repo_name: str):
    """Index a single repository by name"""
    repo_path = os.path.join(REPO_BASE_PATH, repo_name)
    
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")
    
    if not os.path.isdir(repo_path):
        raise ValueError(f"Repository path is not a directory: {repo_path}")
    
    print(f"🔍 Indexing repository: {repo_name}")
    files_indexed = 0
    chunks_indexed = 0
    
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
                        
                        files_indexed += 1
                        chunks_indexed += len(chunks)
                        print(f"✅ Indexed: {tag_base} in {len(chunks)} chunks")
                        
                        # Progress indicator for large repositories
                        if files_indexed % 50 == 0:
                            print(f"📊 Progress: {files_indexed} files indexed")
                            
                except Exception as e:
                    print(f"⚠️ Skipped {file_path}: {str(e)}")
    
    print(f"🎉 Completed indexing {repo_name}: {files_indexed} files, {chunks_indexed} chunks")
    return {"files": files_indexed, "chunks": chunks_indexed}

def walk_and_index(repo_names: Optional[List[str]] = None):
    """
    Index repositories. 
    
    Args:
        repo_names: List of specific repository names to index. 
                   If None, indexes all repositories.
    """
    if repo_names is None:
        # Index all repositories (original behavior)
        repo_names = [name for name in os.listdir(REPO_BASE_PATH) 
                     if os.path.isdir(os.path.join(REPO_BASE_PATH, name))]
        print(f"🔍 Indexing all repositories: {repo_names}")
    else:
        print(f"🔍 Indexing specific repositories: {repo_names}")
    
    total_files = 0
    total_chunks = 0
    
    for repo_name in repo_names:
        try:
            stats = index_single_repository(repo_name)
            total_files += stats["files"]
            total_chunks += stats["chunks"]
        except Exception as e:
            print(f"❌ Failed to index repository {repo_name}: {str(e)}")
    
    print(f"🎉 Indexing complete! Total: {total_files} files, {total_chunks} chunks across {len(repo_names)} repositories")

if __name__ == "__main__":
    walk_and_index()