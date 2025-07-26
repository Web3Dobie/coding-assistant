from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import ChatConversation
from datetime import datetime
from typing import List, Dict

class ChatService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def save_conversation(
        self, 
        project: str, 
        user_messages: List[Dict], 
        assistant_reply: str
    ) -> ChatConversation:
        """Save a chat conversation to database"""
        conversation = ChatConversation(
            project=project,
            user_messages=user_messages,
            assistant_reply=assistant_reply,
            created_at=datetime.utcnow()
        )
        
        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        
        return conversation
    
    async def get_recent_conversations(
        self, 
        project: str, 
        limit: int = 10
    ) -> List[ChatConversation]:
        """Get recent conversations for a project"""
        stmt = select(ChatConversation).where(
            ChatConversation.project == project
        ).order_by(
            ChatConversation.created_at.desc()
        ).limit(limit)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_conversation_stats(self, project: str) -> Dict:
        """Get conversation statistics for a project"""
        total_stmt = select(func.count(ChatConversation.id)).where(
            ChatConversation.project == project
        )
        total_result = await self.db.execute(total_stmt)
        total_conversations = total_result.scalar()
        
        # Count from last 24 hours
        from datetime import timedelta
        yesterday = datetime.utcnow() - timedelta(days=1)
        recent_stmt = select(func.count(ChatConversation.id)).where(
            ChatConversation.project == project,
            ChatConversation.created_at > yesterday
        )
        recent_result = await self.db.execute(recent_stmt)
        recent_conversations = recent_result.scalar()
        
        return {
            "total_conversations": total_conversations,
            "conversations_last_24h": recent_conversations,
            "project": project
        }