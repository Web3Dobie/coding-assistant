import os
import faiss
import pickle
import numpy as np
from openai import AzureOpenAI
from typing import List
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

EMBED_DIM = 1536

# Use persistent storage path (mounted Azure File Share)
VECTOR_STORE_PATH = os.getenv("VECTOR_STORE_PATH", "/mnt/vector-store")
INDEX_PATH = os.path.join(VECTOR_STORE_PATH, "vector_store.faiss")
META_PATH = os.path.join(VECTOR_STORE_PATH, "vector_meta.pkl")

# Ensure the directory exists
os.makedirs(VECTOR_STORE_PATH, exist_ok=True)

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=f"https://{os.getenv('AZURE_RESOURCE_NAME')}.openai.azure.com/",
    api_version=os.getenv("AZURE_API_VERSION")
)

# Global variables for in-memory cache
_index = None
_metadata = None
_last_loaded = None

def load_or_create_index():
    """Load existing index or create new one"""
    global _index, _metadata, _last_loaded
    
    current_time = os.path.getmtime(INDEX_PATH) if os.path.exists(INDEX_PATH) else 0
    
    # Only reload if file changed or not loaded yet
    if _index is None or _last_loaded != current_time:
        if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH):
            print(f"📁 Loading vector store from {INDEX_PATH}")
            _index = faiss.read_index(INDEX_PATH)
            
            with open(META_PATH, "rb") as f:
                _metadata = pickle.load(f)
            
            print(f"✅ Loaded {_index.ntotal} vectors from persistent storage")
        else:
            print("🆕 Creating new vector store")
            _index = faiss.IndexFlatL2(EMBED_DIM)
            _metadata = []
        
        _last_loaded = current_time
    
    return _index, _metadata

def save_index():
    """Save index to persistent storage"""
    global _index, _metadata
    
    if _index is not None and _metadata is not None:
        print(f"💾 Saving vector store to {INDEX_PATH}")
        faiss.write_index(_index, INDEX_PATH)
        
        with open(META_PATH, "wb") as f:
            pickle.dump(_metadata, f)
        
        print(f"✅ Saved {_index.ntotal} vectors to persistent storage")

def embed_text(text: str) -> List[float]:
    try:
        response = client.embeddings.create(
            model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_ID"),
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"❌ Embedding error: {e}")
        # Return a zero vector or raise a more specific exception
        return [0.0] * EMBED_DIM

def add_document(text: str, source_path: str):
    """Add document to vector store"""
    index, metadata = load_or_create_index()
    
    try:
        embedding = embed_text(text)
        index.add(np.array([embedding]).astype('float32'))
        metadata.append({"text": text, "source": source_path})
        
        # Save every 10 documents to avoid too frequent I/O
        if len(metadata) % 10 == 0:
            save_index()
            
    except Exception as e:
        print(f"❌ Error adding document: {e}")
        raise

def get_relevant_chunks(query: str, top_k=5) -> str:
    """Get relevant code chunks for query"""
    index, metadata = load_or_create_index()
    
    if index.ntotal == 0:
        return "No code context available. Please run /reindex to index the codebase."
    
    try:
        query_vec = embed_text(query)
        D, I = index.search(np.array([query_vec]).astype('float32'), min(top_k, index.ntotal))
        
        relevant_chunks = []
        for i in I[0]:
            if i < len(metadata) and i >= 0:  # Valid index
                chunk = metadata[i]
                relevant_chunks.append(f"File: {chunk['source']}\n{chunk['text']}")
        
        return "\n---\n".join(relevant_chunks)
        
    except Exception as e:
        print(f"❌ Error retrieving chunks: {e}")
        return "Error retrieving code context."

def get_vector_store_stats():
    """Get statistics about the vector store"""
    index, metadata = load_or_create_index()
    
    return {
        "total_vectors": index.ntotal if index else 0,
        "total_metadata": len(metadata) if metadata else 0,
        "index_file_exists": os.path.exists(INDEX_PATH),
        "metadata_file_exists": os.path.exists(META_PATH),
        "storage_path": VECTOR_STORE_PATH
    }

def force_save():
    """Force save the current index state"""
    save_index()