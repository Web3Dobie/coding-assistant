import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import AzureOpenAI
import json
from datetime import datetime
import embed
import github_sync
import index_codebase

app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
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

@app.post("/chat")
async def chat(request: ChatRequest):
    project = request.project
    messages = [msg.dict(exclude_none=True) for msg in request.messages]

    # Prepend a system message for context with the project name
    system_message = {
        "role": "system",
        "content": f"You are a coding assistant helping with the {project} project."
    }
    full_messages = [system_message] + messages

    # Call Azure OpenAI chat completion
    response = client.chat.completions.create(
        model=os.getenv("AZURE_DEPLOYMENT_ID"),
        messages=full_messages,
        temperature=0.3
    )
    assistant_reply = response.choices[0].message.content

    # Log interaction to JSON file
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "project": project,
        "user_messages": messages,
        "assistant_reply": assistant_reply
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
    except Exception as e:
        print(f"Failed to write chat log: {e}")

    return {"response": assistant_reply}

@app.post("/reindex")
async def reindex():
    try:
        repos = [
            {"name": "X-Agent", "url": "https://github.com/youruser/X-Agent.git"},
            {"name": "DutchBrat-Website", "url": "https://github.com/youruser/DutchBrat-Website.git"},
            {"name": "Coding-Assistant", "url": "https://github.com/Web3Dobie/coding-assistant.git"},
            {"name": "Hedgefund-Agent", "url": "https://github.com/youruser/Hedgefund-Agent.git"}
        ]
        github_sync.sync_repos(repos)
        index_codebase.walk_and_index()
        return {"status": "✅ Reindex complete"}
    except Exception as e:
        return {"status": f"❌ Reindex failed: {str(e)}"}
