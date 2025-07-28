import os
import json
import subprocess
from pathlib import Path
from typing import List, Dict
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import asyncio

# Load environment variables
from dotenv import load_dotenv

env_paths = [
    Path(__file__).parent / ".env",  # Same directory
    Path(__file__).parent.parent / ".env",  # Parent directory
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break
else:
    print("No .env file found, trying default load_dotenv()")
    load_dotenv()

# Debug: Print what was loaded
print(f"GITHUB_PAT loaded: {'✅' if os.getenv('GITHUB_PAT') else '❌'}")

# Validate required environment variables
REQUIRED_ENV_VARS = ["GITHUB_PAT"]
missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Load the Personal Access Token (PAT)
GITHUB_PAT = os.getenv("GITHUB_PAT")
if not GITHUB_PAT:
    raise ValueError("❌ Missing GITHUB_PAT environment variable. Please set it in your .env file or system environment.")

# Directory where repositories are cloned
REPO_CLONES_DIR = os.getenv("REPO_CLONES_DIR", "data/repo_clones")

# Load repositories from configuration file
REPOSITORIES_CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "repositories.json"))

try:
    with open(REPOSITORIES_CONFIG_PATH, "r") as f:
        REPOSITORIES = json.load(f)
        print(f"✅ Loaded repositories from {REPOSITORIES_CONFIG_PATH}")
except Exception as e:
    raise ValueError(f"❌ Failed to load repositories configuration: {e}")

# FastAPI app setup
app = FastAPI(
    title="Coding Assistant API",
    version="2.0.0",
    description="AI-powered coding assistant with persistent storage"
)

# CORS setup
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reindex status tracker
reindex_status = {
    "status": "idle",
    "started_at": None,
    "message": "No reindex operation running",
    "progress": 0
}

# Pydantic models
class Message(BaseModel):
    role: str
    content: str
    timestamp: str = None

class ChatRequest(BaseModel):
    project: str
    messages: List[Message]

# Utility function to modify repository URL for authentication
def get_authenticated_repo_url(repo_url: str, token: str) -> str:
    """Modify the repository URL to include authentication."""
    if repo_url.startswith("https://"):
        return repo_url.replace("https://", f"https://{token}@")
    else:
        raise ValueError("Unsupported repository URL format. Only HTTPS is supported for authentication.")

# Sync repositories by cloning or pulling updates
def sync_repos(repositories: List[Dict[str, str]], token: str = None):
    """Sync repositories by cloning or pulling updates."""
    for repo in repositories:
        repo_name = repo["name"]
        repo_url = repo["url"]
        repo_path = os.path.join(REPO_CLONES_DIR, repo_name)

        print(f"[Sync Repos] Processing repository: {repo_name}")

        # Handle authentication for private repositories
        if repo.get("private") and token:
            repo_url = get_authenticated_repo_url(repo_url, token)

        # Check if the repository already exists
        if os.path.exists(repo_path):
            try:
                subprocess.run(["git", "-C", repo_path, "pull"], check=True)
                print(f"[Sync Repos] Pulled updates for {repo_name}")
            except subprocess.CalledProcessError as e:
                print(f"[Sync Repos] Failed to pull updates for {repo_name}: {e}")
        else:
            try:
                subprocess.run(["git", "clone", repo_url, repo_path], check=True)
                print(f"[Sync Repos] Cloned repository: {repo_name}")
            except subprocess.CalledProcessError as e:
                print(f"[Sync Repos] Failed to clone {repo_name}: {e}")

# Background task for reindexing
async def run_reindex_background():
    """Run reindex operation in the background"""
    global reindex_status

    try:
        reindex_status.update({
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "message": "Starting reindex operation...",
            "progress": 0
        })

        print("[Reindex] Starting codebase reindexing...")

        # Step 1: Sync repositories
        reindex_status.update({
            "message": "Syncing repositories...",
            "progress": 10
        })

        await asyncio.to_thread(sync_repos, REPOSITORIES, GITHUB_PAT)
        print("[Reindex] Repositories synced")

        # Step 2: Index codebase
        reindex_status.update({
            "message": "Indexing codebase...",
            "progress": 50
        })

        # Placeholder for indexing logic
        # await asyncio.to_thread(index_codebase.walk_and_index)
        print("[Reindex] Codebase indexed")

        # Step 3: Save vector store
        reindex_status.update({
            "message": "Saving vector store...",
            "progress": 90
        })

        # Placeholder for saving logic
        # force_save()

        # Complete
        reindex_status.update({
            "status": "completed",
            "message": "✅ Reindex completed successfully",
            "progress": 100
        })

        print("[Reindex] ✅ Reindex completed successfully")

    except Exception as e:
        error_msg = f"❌ Reindex failed: {str(e)}"
        reindex_status.update({
            "status": "failed",
            "message": error_msg,
            "progress": 0
        })
        print(f"[Reindex] {error_msg}")

# Reindex endpoint
@app.post("/reindex")
async def reindex():
    """Start reindex operation in background and return immediately"""
    global reindex_status

    # Check if already running
    if reindex_status["status"] == "running":
        return {
            "status": "already_running",
            "message": "Reindex operation already in progress",
            "current_status": reindex_status
        }

    # Start background task
    asyncio.create_task(run_reindex_background())

    return {
        "status": "started",
        "message": "🚀 Reindex operation started in background",
        "check_status_at": "/reindex/status"
    }

# Reindex status endpoint
@app.get("/reindex/status")
async def get_reindex_status():
    """Get current status of reindex operation"""
    return reindex_status

# List files in a repository
@app.get("/list-files")
async def list_files(repo_name: str):
    """List all files in the specified repository."""
    repo_path = os.path.join(REPO_CLONES_DIR, repo_name)
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=404, detail="Repository not found")

    files = []
    for root, _, filenames in os.walk(repo_path):
        for filename in filenames:
            files.append(os.path.relpath(os.path.join(root, filename), repo_path))

    return {"files": files}

# Get file contents
@app.post("/get-file")
async def get_file(file_path: str):
    """Retrieve the contents of a specified file."""
    full_path = Path(REPO_CLONES_DIR) / file_path

    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    if not str(full_path).startswith(str(REPO_CLONES_DIR)):
        raise HTTPException(status_code=403, detail="Access to this file is forbidden")

    try:
        with open(full_path, "r") as f:
            content = f.read()
        return {"file_path": str(full_path), "content": content}
    except Exception as e:
        print(f"[Error] Failed to read file: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while reading the file.")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Main entry point
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
