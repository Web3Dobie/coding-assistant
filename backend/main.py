import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from openai import AzureOpenAI
import json
from datetime import datetime
import embed
import github_sync
import index_codebase
from embed import get_relevant_chunks
import fnmatch

app = FastAPI()

# Use an environment variable to determine the base path
REPO_BASE_PATH = os.getenv(
    "REPO_BASE_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "repo_clones"))  # Default for local development
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://127.0.0.1:5174",
    #"http://localhost:5174",
    #"http://frontend:5174"
    #],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version=os.getenv("AZURE_API_VERSION"),
    azure_endpoint=f"https://{os.getenv('AZURE_RESOURCE_NAME')}.openai.azure.com"
)

# Pydantic models for chat messages and requests
class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    project: str
    messages: List[Message]

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    return response

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        project = request.project
        messages = [msg.dict(exclude_none=True) for msg in request.messages]

        print(f"[Chat] Received project: {project}")
        print(f"[Chat] Received messages: {messages}")

        # Combine user messages content for context retrieval
        user_text = " ".join(msg["content"] for msg in messages if msg["role"] == "user")

        relevant_code = get_relevant_chunks(user_text, top_k=5)
        print(f"[Chat] Relevant code snippet (truncated): {relevant_code[:300]}")

        system_message = {
            "role": "system",
            "content": (
                f"You are a coding assistant helping with the {project} project.\n\n"
                "Use the following code snippets as context:\n"
                f"{relevant_code}"
            )
        }

        full_messages = [system_message] + messages

        # Call Azure OpenAI chat completion
        try:
            response = client.chat.completions.create(
                model=os.getenv("AZURE_DEPLOYMENT_ID"),
                messages=full_messages,
                temperature=0.3,
            )
            assistant_reply = response.choices[0].message.content
            print(f"[Chat] Assistant reply: {assistant_reply[:300]}")
        except Exception as e:
            print(f"[Chat] OpenAI API error: {e}")
            assistant_reply = "⚠️ Sorry, I couldn't process your request."

        # Log interaction
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "project": project,
            "user_messages": messages,
            "assistant_reply": assistant_reply,
        }
        log_path = os.path.join(os.path.dirname(__file__), "chat_log.json")
        try:
            if os.path.exists(log_path):
                with open(log_path, "r", encoding="utf-8") as f:
                    chat_log = json.load(f)
            else:
                chat_log = []
            chat_log.append(log_entry)
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(chat_log, f, indent=2)
            print("[Chat] Logged chat interaction.")
        except Exception as e:
            print(f"[Chat] Failed to write chat log: {e}")

        return {"response": assistant_reply}

    except Exception as e:
        print(f"[Chat] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@app.post("/reindex")
async def reindex():
    try:
        repos = [
            {"name": "X-Agent", "url": "https://github.com/youruser/X-Agent.git"},
            {"name": "DutchBrat-Website", "url": "https://github.com/youruser/DutchBrat-Website.git"},
            {"name": "Coding-Assistant", "url": "https://github.com/Web3Dobie/coding-assistant.git"},
            {"name": "Hedgefund-Agent", "url": "https://github.com/youruser/Hedgefund-Agent.git"},
            {"name": "Trading-Bot", "url": "https://github.com/youruser/trading-bot.git"}
        ]
        github_sync.sync_repos(repos)
        index_codebase.walk_and_index()
        return {"status": "✅ Reindex complete"}
    except Exception as e:
        return {"status": f"❌ Reindex failed: {str(e)}"}

@app.post("/get-file")
async def get_file(request: Request):
    # Parse JSON payload
    body = await request.json()
    file_path = body.get("file_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="File path not provided")

    full_path = os.path.join(REPO_BASE_PATH, file_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        return FileResponse(full_path, media_type="application/octet-stream", filename=os.path.basename(full_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")

@app.get("/list-files")
async def list_files(repo_name: str = ""):
    repo_path = os.path.join(REPO_BASE_PATH, repo_name)
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_name}")

    excluded_dirs = {"__pycache__", ".git"}
    excluded_patterns = ["*.pyc", "*.log"]

    file_list = []
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in excluded_dirs]

        for file in files:
            # Skip files matching excluded patterns
            if any(fnmatch.fnmatch(file, pattern) for pattern in excluded_patterns):
                continue
            file_path = os.path.relpath(os.path.join(root, file), REPO_BASE_PATH)
            file_list.append(file_path)

    return JSONResponse(content={"files": file_list})