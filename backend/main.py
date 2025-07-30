import os
import json
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import asyncio
import time

# Import our modules
import embed
import github_sync
import index_codebase
from embed import get_relevant_chunks, get_vector_store_stats, force_save
from database import init_database, get_db, cleanup_old_conversations
from chat_service import ChatService
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AzureOpenAI
from index_codebase import REPO_BASE_PATH

# Load environment variables (only for local development)
# Azure Container Apps provides these directly
try:
    from dotenv import load_dotenv
    load_dotenv()  # This will be ignored in Azure Container Apps
except ImportError:
    pass  # dotenv not installed in production

# Validate required environment variables
REQUIRED_ENV_VARS = [
    "AZURE_OPENAI_API_KEY",
    "AZURE_RESOURCE_NAME", 
    "AZURE_API_VERSION",
    "AZURE_DEPLOYMENT_ID",
    "AZURE_EMBEDDING_DEPLOYMENT_ID",
    "DATABASE_URL",
    "GITHUB_PAT"
]

missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

REPO_CLONES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))

# Load repositories from configuration file
REPOSITORIES_CONFIG_PATH = Path(__file__).parent / "repositories.json"

try:
    with open(REPOSITORIES_CONFIG_PATH, "r") as f:
        REPOSITORIES = json.load(f)
        print(f"✅ Loaded {len(REPOSITORIES)} repositories from config")
except Exception as e:
    raise ValueError(f"❌ Failed to load repositories configuration: {e}")

print("✅ Environment and configuration loaded successfully")

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
async def run_reindex_background(repo_name: str):
    """Run reindex operation in the background with detailed logging for specific repository"""
    global reindex_status
    
    try:
        reindex_status.update({
            "status": "running",
            "repo_name": repo_name,
            "started_at": datetime.utcnow().isoformat(),
            "message": f"Starting reindex operation for {repo_name}...",
            "progress": 0
        })
        
        print(f"[Reindex] 🚀 Starting codebase reindexing for repository: {repo_name}")
        
        # Get GITHUB_PAT from environment
        github_pat = os.getenv("GITHUB_PAT")
        if not github_pat:
            raise ValueError("GITHUB_PAT environment variable not found")
        
        # Step 1: Sync specific repository with PAT
        print(f"[Reindex] 📥 Starting repository sync for {repo_name}...")
        reindex_status.update({
            "message": f"Syncing repository {repo_name}...",
            "progress": 10
        })
        
        start_time = time.time()
        # Find the specific repository configuration from REPOSITORIES
        target_repo = None
        for repo in REPOSITORIES:
            if repo["name"] == repo_name:
                target_repo = repo
                break
        
        if not target_repo:
            raise ValueError(f"Repository '{repo_name}' not found in REPOSITORIES configuration")
        
        # Sync only the specified repository (pass as list of dict)
        await asyncio.to_thread(github_sync.sync_repos, [target_repo], github_pat)
        sync_duration = time.time() - start_time
        print(f"[Reindex] ✅ Repository {repo_name} synced in {sync_duration:.1f}s")
        
        # Step 2: Index specific repository codebase with progress tracking
        print(f"[Reindex] 📊 Starting codebase indexing for {repo_name}...")
        reindex_status.update({
            "message": f"Indexing {repo_name} codebase...",
            "progress": 50
        })
        
        # Add periodic status updates during indexing
        def update_indexing_progress():
            """Periodically update status during long indexing process"""
            while reindex_status["status"] == "running" and reindex_status["progress"] < 90:
                time.sleep(10)  # Update every 10 seconds
                if reindex_status["status"] == "running":
                    current_time = datetime.utcnow().isoformat()
                    reindex_status.update({
                        "message": f"Still indexing {repo_name}... (last update: {current_time})",
                        "progress": 50
                    })
                    print(f"[Reindex] 🔄 Still processing {repo_name} files... (alive check)")
        
        # Start progress updater in background
        progress_task = asyncio.create_task(asyncio.to_thread(update_indexing_progress))
        
        try:
            # Run indexing in thread pool for specific repository only
            start_time = time.time()
            await asyncio.to_thread(index_codebase.walk_and_index, [repo_name])
            
            index_duration = time.time() - start_time
            print(f"[Reindex] ✅ Repository {repo_name} indexed in {index_duration:.1f}s")
        finally:
            # Cancel progress updater
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass
        
        # Step 3: Save vector store
        print(f"[Reindex] 💾 Saving vector store for {repo_name}...")
        reindex_status.update({
            "message": f"Saving vector store for {repo_name}...",
            "progress": 90
        })
        
        start_time = time.time()
        force_save()
        save_duration = time.time() - start_time
        print(f"[Reindex] ✅ Vector store for {repo_name} saved in {save_duration:.1f}s")
        
        # Complete
        reindex_status.update({
            "status": "completed",
            "repo_name": repo_name,
            "message": f"✅ Reindex completed successfully for {repo_name}",
            "progress": 100,
            "completed_at": datetime.utcnow().isoformat()
        })
        
        print(f"[Reindex] 🎉 Reindex completed successfully for {repo_name}")
        
    except Exception as e:
        error_msg = f"❌ Reindex failed for {repo_name}: {str(e)}"
        reindex_status.update({
            "status": "failed",
            "repo_name": repo_name,
            "message": error_msg,
            "progress": 0,
            "error": str(e),
            "failed_at": datetime.utcnow().isoformat()
        })
        print(f"[Reindex] {error_msg}")
        print(f"[Reindex] Error details: {repr(e)}")  # More detailed error info

async def run_reindex_background_all():
    """Run reindex operation for all repositories in the background"""
    print(f"🐛 DEBUG: run_reindex_background_all called for ALL repositories")
    global reindex_status
    
    try:
        print(f"🐛 DEBUG: About to update reindex_status")
        reindex_status.update({
            "status": "running",
            "repo_name": "all repositories",
            "started_at": datetime.utcnow().isoformat(),
            "message": "Starting reindex operation for all repositories...",
            "progress": 0
        })
        
        print("[Reindex] 🚀 Starting codebase reindexing for ALL repositories")
        
        # Get GITHUB_PAT from environment
        github_pat = os.getenv("GITHUB_PAT")
        if not github_pat:
            raise ValueError("GITHUB_PAT environment variable not found")
        
        # Step 1: Sync all repositories
        print("[Reindex] 📥 Starting repository sync for all repositories...")
        reindex_status.update({
            "message": "Syncing all repositories...",
            "progress": 10
        })
        
        start_time = time.time()
        await asyncio.to_thread(github_sync.sync_repos, REPOSITORIES, github_pat)
        sync_duration = time.time() - start_time
        print(f"[Reindex] ✅ All repositories synced in {sync_duration:.1f}s")
        
        # Step 2: Index all repositories
        print("[Reindex] 📊 Starting codebase indexing for all repositories...")
        reindex_status.update({
            "message": "Indexing all repositories...",
            "progress": 50
        })
        
        # Progress updater (same as before)
        def update_indexing_progress():
            while reindex_status["status"] == "running" and reindex_status["progress"] < 90:
                time.sleep(10)
                if reindex_status["status"] == "running":
                    current_time = datetime.utcnow().isoformat()
                    reindex_status.update({
                        "message": f"Still indexing all repositories... (last update: {current_time})",
                        "progress": 50
                    })
                    print("[Reindex] 🔄 Still processing files from all repositories... (alive check)")
        
        progress_task = asyncio.create_task(asyncio.to_thread(update_indexing_progress))
        
        try:
            start_time = time.time()
            # Pass None to index all repositories
            await asyncio.to_thread(index_codebase.walk_and_index, None)
            index_duration = time.time() - start_time
            print(f"[Reindex] ✅ All repositories indexed in {index_duration:.1f}s")
        finally:
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass
        
        # Step 3: Save vector store
        print("[Reindex] 💾 Saving vector store for all repositories...")
        reindex_status.update({
            "message": "Saving vector store for all repositories...",
            "progress": 90
        })
        
        start_time = time.time()
        force_save()
        save_duration = time.time() - start_time
        print(f"[Reindex] ✅ Vector store for all repositories saved in {save_duration:.1f}s")
        
        # Complete
        reindex_status.update({
            "status": "completed",
            "repo_name": "all repositories",
            "message": "✅ Reindex completed successfully for all repositories",
            "progress": 100,
            "completed_at": datetime.utcnow().isoformat()
        })
        
        print("[Reindex] 🎉 Reindex completed successfully for all repositories")
        
    except Exception as e:
        error_msg = f"❌ Reindex failed for all repositories: {str(e)}"
        reindex_status.update({
            "status": "failed",
            "repo_name": "all repositories",
            "message": error_msg,
            "progress": 0,
            "error": str(e),
            "failed_at": datetime.utcnow().isoformat()
        })
        print(f"[Reindex] {error_msg}")
        print(f"[Reindex] Error details: {repr(e)}")

# Reindex endpoints
@app.post("/reindex-all")
async def reindex_all_repositories():
    """Start reindex operation for ALL repositories in background and return immediately"""
    global reindex_status

    # Check if already running
    if reindex_status["status"] == "running":
        return {
            "status": "already_running",
            "message": f"Reindex operation already in progress for {reindex_status.get('repo_name', 'unknown repo')}",
            "current_status": reindex_status
        }

    # Start background task for all repositories (pass None to index all)
    asyncio.create_task(run_reindex_background_all())

    return {
        "status": "started",
        "message": "🚀 Reindex operation started in background for all repositories",
        "check_status_at": "/reindex/status"
    }

@app.post("/reindex")
async def reindex(request: dict):
    """Start reindex operation in background and return immediately"""
    global reindex_status
    
    # Extract repository name from request
    repo_name = request.get("repo_name")
    print(f"🐛 DEBUG: Received reindex request for: {repo_name}")  # Add this
    
    if not repo_name:
        return {
            "status": "error",
            "message": "Repository name is required"
        }

    # Check if already running
    if reindex_status["status"] == "running":
        return {
            "status": "already_running", 
            "message": f"Reindex operation already in progress for {reindex_status.get('repo_name', 'unknown repo')}",
            "current_status": reindex_status
        }

    print(f"🐛 DEBUG: Starting background task for: {repo_name}")  # Add this
    
    # Start background task with specified repository
    task = asyncio.create_task(run_reindex_background(repo_name))
    print(f"🐛 DEBUG: Background task created: {task}")  # Add this

    return {
        "status": "started",
        "message": f"🚀 Reindex operation started in background for {repo_name}",
        "repo_name": repo_name,
        "check_status_at": "/reindex/status"
    }

# Reindex status endpoint
@app.get("/reindex/status")
async def get_reindex_status():
    """Get current status of reindex operation"""
    return reindex_status

@app.get("/reindex/ping")
async def ping_reindex():
    """Ping endpoint to check if reindex process is responsive"""
    return {
        "status": "pong",
        "timestamp": datetime.utcnow().isoformat(),
        "current_status": reindex_status
    }

# List files in a repository
@app.get("/list-files")
async def list_files(repo_name: str):
    """List all files in the specified repository."""
    repo_path = os.path.join(REPO_BASE_PATH, repo_name)  # Change this line
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

@app.get("/repositories")
async def get_repositories():
    """Get list of available repositories"""
    try:
        return {
            "repositories": [repo["name"] for repo in REPOSITORIES],
            "count": len(REPOSITORIES)
        }
    except Exception as e:
        print(f"Error loading repositories: {e}")
        return {
            "repositories": [],
            "count": 0,
            "error": str(e)
        }
        
@app.post("/chat")
async def chat(
    request: ChatRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Main chat endpoint for AI-powered coding assistance"""
    try:
        project = request.project
        messages = [msg.dict(exclude_none=True) for msg in request.messages]

        print(f"[Chat] Project: {project}, Messages: {len(messages)}")

        # Validate inputs
        if not project or not messages:
            raise HTTPException(status_code=400, detail="Project and messages required")

        # Get user message content for context retrieval
        user_text = " ".join(msg["content"] for msg in messages if msg["role"] == "user")
        
        # Get relevant code context
        try:
            relevant_code = get_relevant_chunks(user_text, top_k=5)
            print(f"[Chat] Retrieved relevant code context")
        except Exception as e:
            print(f"[Chat] Vector search failed: {e}")
            relevant_code = "No relevant code context available. Try running /reindex."

        # Build enhanced system message
        system_message = {
            "role": "system",
            "content": (
                f"You are an expert coding assistant for the {project} project. "
                f"You help with code analysis, debugging, documentation, and improvements.\n\n"
                f"Relevant code context:\n{relevant_code}\n\n"
                f"Guidelines:\n"
                f"- Provide clear, actionable advice\n"
                f"- Reference the provided code when relevant\n"
                f"- Suggest specific improvements\n"
                f"- Use code examples when helpful\n"
                f"- If context is insufficient, ask for clarification"
            )
        }

        full_messages = [system_message] + messages

        # Call Azure OpenAI
        try:
            # Initialize OpenAI client (make sure this is defined somewhere)
            client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_API_VERSION"),
                azure_endpoint=f"https://{os.getenv('AZURE_RESOURCE_NAME')}.openai.azure.com"
            )
            
            response = client.chat.completions.create(
                model=os.getenv("AZURE_DEPLOYMENT_ID"),
                messages=full_messages,
                temperature=0.3,
                max_tokens=2000,
                timeout=30
            )
            assistant_reply = response.choices[0].message.content
            print(f"[Chat] Generated response ({len(assistant_reply)} chars)")
            
        except Exception as openai_error:
            print(f"[Chat] OpenAI API error: {openai_error}")
            raise HTTPException(
                status_code=503,
                detail="AI service temporarily unavailable. Please try again."
            )

        # Save conversation to database (background task)
        chat_service = ChatService(db)
        background_tasks.add_task(
            save_conversation_bg,
            chat_service,
            project,
            messages,
            assistant_reply
        )

        return {"response": assistant_reply}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Chat] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def save_conversation_bg(
    chat_service: ChatService, 
    project: str, 
    messages: list, 
    assistant_reply: str
):
    """Background task to save conversation"""
    try:
        await chat_service.save_conversation(project, messages, assistant_reply)
        print("[Chat] Conversation saved to database")
    except Exception as e:
        print(f"[Chat] Failed to save conversation: {e}")


# Main entry point
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

#force git update