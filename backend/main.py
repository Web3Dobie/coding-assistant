import sys
import os
from pathlib import Path

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import AzureOpenAI
from datetime import datetime
import asyncio

# Import our modules
import embed
import github_sync
import index_codebase
from embed import get_relevant_chunks, get_vector_store_stats, force_save
from database import init_database, get_db, cleanup_old_conversations
from chat_service import ChatService
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Try multiple .env locations
env_paths = [
    Path(__file__).parent / ".env",  # Same directory
    Path(__file__).parent.parent / ".env",  # Parent directory
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break

# Validate required environment variables
REQUIRED_ENV_VARS = [
    "AZURE_OPENAI_API_KEY",
    "AZURE_RESOURCE_NAME", 
    "AZURE_API_VERSION",
    "AZURE_DEPLOYMENT_ID",
    "AZURE_EMBEDDING_DEPLOYMENT_ID",
    "DATABASE_URL"
]

missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

app = FastAPI(
    title="Coding Assistant API", 
    version="2.0.0",
    description="AI-powered coding assistant with persistent storage"
)

# CORS setup
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5174,http://127.0.0.1:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://coding-assistant-frontend.ambitiouspebble-f6886645.swedencentral.azurecontainerapps.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
try:
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version=os.getenv("AZURE_API_VERSION"),
        azure_endpoint=f"https://{os.getenv('AZURE_RESOURCE_NAME')}.openai.azure.com"
    )
    print("✅ Azure OpenAI client initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize Azure OpenAI client: {e}")
    raise

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database and cleanup old data"""
    try:
        await init_database()
        print("✅ Database initialized")
        
        # Run cleanup in background
        asyncio.create_task(cleanup_old_conversations())
        print("🧹 Started background cleanup task")
        
        # Load vector store
        embed.load_or_create_index()
        print("✅ Vector store loaded")
        
    except Exception as e:
        print(f"❌ Startup error: {e}")
        raise

# Pydantic models
class Message(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    project: str
    messages: List[Message]

# Health check endpoint
@app.get("/health")
async def health_check():
    """Enhanced health check with database and vector store status"""
    try:
        # Check database connection
        async for session in get_db():
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
            break
        
        # Check vector store
        vector_stats = get_vector_store_stats()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": "connected",
            "vector_store": vector_stats,
            "environment": {
                "azure_configured": bool(os.getenv("AZURE_OPENAI_API_KEY")),
                "database_configured": bool(os.getenv("DATABASE_URL")),
                "vector_store_path": os.getenv("VECTOR_STORE_PATH", "/mnt/vector-store")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")

# Main chat endpoint
@app.post("/chat")
async def chat(
    request: ChatRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
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

@app.post("/reindex")
async def reindex(background_tasks: BackgroundTasks):
    """Reindex the codebase and save to persistent storage"""
    try:
        print("[Reindex] Starting codebase reindexing...")
        
        # Define repositories
        repos = [
            {"name": "X-Agent", "url": "https://github.com/Web3Dobie/X-AI-Agent.git"},
            {"name": "DutchBrat-Website", "url": "https://github.com/Web3Dobie/dutchbrat.com.git"},
            {"name": "Coding-Assistant", "url": "https://github.com/Web3Dobie/coding-assistant.git"},
            {"name": "Hedgefund-Agent", "url": "https://github.com/Web3Dobie/HedgeFundAgent.git"}
        ]
        
        # Sync repositories
        github_sync.sync_repos(repos)
        print("[Reindex] Repositories synced")
        
        # Reindex codebase
        index_codebase.walk_and_index()
        print("[Reindex] Codebase indexed")
        
        # Force save to persistent storage
        background_tasks.add_task(force_save)
        
        return {"status": "✅ Reindex completed successfully"}
        
    except Exception as e:
        print(f"[Reindex] Error: {e}")
        return {"status": f"❌ Reindex failed: {str(e)}"}
        

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)