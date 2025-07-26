import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime, timedelta
from typing import AsyncGenerator

# Database configuration
# Get database URL and convert to async format
# Get database URL and convert to async format
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    # Convert postgresql:// to postgresql+asyncpg:// for async support
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    # Remove SSL parameters - let Azure handle SSL automatically
    if "?sslmode=require" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("?sslmode=require", "")
    if "?ssl=true" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("?ssl=true", "")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Create async engine with explicit asyncpg driver
engine = create_async_engine(
    DATABASE_URL,
    echo=True if os.getenv("ENVIRONMENT") == "development" else False,
    pool_pre_ping=True,
    pool_recycle=300,
    # Force asyncpg driver
    connect_args={"server_settings": {"application_name": "coding_assistant"}}
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Base class for models
class Base(DeclarativeBase):
    pass

# Chat conversation model
class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    project = Column(String(100), nullable=False, index=True)
    user_messages = Column(JSON, nullable=False)
    assistant_reply = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# Database session dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

# Database initialization
async def init_database():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully")

# Cleanup old conversations (older than 7 days)
async def cleanup_old_conversations():
    """Remove conversations older than 7 days"""
    cutoff_date = datetime.utcnow() - timedelta(days=7)
    
    async with AsyncSessionLocal() as session:
        from sqlalchemy import delete
        
        stmt = delete(ChatConversation).where(
            ChatConversation.created_at < cutoff_date
        )
        result = await session.execute(stmt)
        await session.commit()
        
        deleted_count = result.rowcount
        if deleted_count > 0:
            print(f"🗑️ Cleaned up {deleted_count} old conversations")
        
        return deleted_count