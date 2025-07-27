import os
import faiss
import pickle
import numpy as np
from openai import AzureOpenAI
from typing import List
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
from pathlib import Path
import fcntl  # For file locking
import time
import tempfile

load_dotenv()

EMBED_DIM = 1536

# Use persistent storage path (mounted Azure File Share)
VECTOR_STORE_PATH = os.getenv("VECTOR_STORE_PATH", "/tmp/vector-store")
INDEX_PATH = os.path.join(VECTOR_STORE_PATH, "vector_store.faiss")
META_PATH = os.path.join(VECTOR_STORE_PATH, "vector_meta.pkl")
LOCK_PATH = os.path.join(VECTOR_STORE_PATH, "vector_store.lock")

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

def acquire_lock(timeout=30):
    """Acquire exclusive lock for vector store operations"""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            lock_file = open(LOCK_PATH, 'w')
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return lock_file
        except (IOError, OSError):
            time.sleep(0.1)
    raise TimeoutError("Could not acquire lock for vector store")

def release_lock(lock_file):
    """Release the vector store lock"""
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        lock_file.close()
        if os.path.exists(LOCK_PATH):
            os.remove(LOCK_PATH)
    except Exception as e:
        print(f"Warning: Could not release lock: {e}")

def load_or_create_index():
    """Load existing index or create new one - ONLY load once"""
    global _index, _metadata, _last_loaded
    
    # Only load if not already loaded
    if _index is not None and _metadata is not None:
        return _index, _metadata
    
    try:
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
        
        _last_loaded = time.time()
        
    except Exception as e:
        print(f"❌ Error loading vector store: {e}")
        print("🆕 Creating new vector store due to error")
        _index = faiss.IndexFlatL2(EMBED_DIM)
        _metadata = []
        _last_loaded = time.time()
    
    return _index, _metadata

def save_index():
    """Save index to persistent storage with atomic writes and locking"""
    global _index, _metadata
    
    if _index is None or _metadata is None:
        print("⚠️ No index to save")
        return
    
    lock_file = None
    try:
        # Acquire exclusive lock for writing
        lock_file = acquire_lock(timeout=10)
        
        print(f"💾 Saving vector store to {INDEX_PATH}")
        
        # Use atomic writes to prevent corruption
        temp_index = INDEX_PATH + ".tmp"
        temp_meta = META_PATH + ".tmp"
        
        # Write to temporary files first
        faiss.write_index(_index, temp_index)
        with open(temp_meta, "wb") as f:
            pickle.dump(_metadata, f)
        
        # Atomically move temp files to final location
        os.rename(temp_index, INDEX_PATH)
        os.rename(temp_meta, META_PATH)
        
        print(f"✅ Saved {_index.ntotal} vectors to persistent storage")
        
    except Exception as e:
        print(f"❌ Error saving vector store: {e}")
        # Clean up temp files on error
        for temp_file in [INDEX_PATH + ".tmp", META_PATH + ".tmp"]:
            if os.path.exists(temp_file):
                os.remove(temp_file)
    finally:
        if lock_file:
            release_lock(lock_file)

def embed_text(text: str) -> List[float]:
    try:
        response = client.embeddings.create(
            model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_ID"),
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"❌ Embedding error: {e}")
        return [0.0] * EMBED_DIM

def add_document(text: str, source_path: str):
    """Add document to vector store WITHOUT frequent saves"""
    index, metadata = load_or_create_index()
    
    try:
        embedding = embed_text(text)
        index.add(np.array([embedding]).astype('float32'))
        metadata.append({"text": text, "source": source_path})
        
        # REMOVE THIS LINE - it's causing the I/O storm
        # if len(metadata) % 10 == 0:
        #     save_index()
        
        # Only log progress every 100 documents
        if len(metadata) % 100 == 0:
            print(f"📊 Progress: {len(metadata)} documents indexed")
            
    except Exception as e:
        print(f"❌ Error adding document: {e}")
        raise

def get_relevant_chunks(query: str, top_k=5) -> str:
    """Get relevant code chunks for query with better error handling"""
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
        # Try to recover by recreating the index
        try:
            print("🔄 Attempting to recover by clearing corrupted index...")
            global _index, _metadata
            _index = faiss.IndexFlatL2(EMBED_DIM)
            _metadata = []
            return "Code context temporarily unavailable due to index corruption. Please run /reindex."
        except:
            return "Error retrieving code context."

def get_vector_store_stats():
    """Get statistics about the vector store"""
    try:
        index, metadata = load_or_create_index()
        
        return {
            "total_vectors": index.ntotal if index else 0,
            "total_metadata": len(metadata) if metadata else 0,
            "index_file_exists": os.path.exists(INDEX_PATH),
            "metadata_file_exists": os.path.exists(META_PATH),
            "storage_path": VECTOR_STORE_PATH,
            "index_file_size": os.path.getsize(INDEX_PATH) if os.path.exists(INDEX_PATH) else 0,
            "metadata_file_size": os.path.getsize(META_PATH) if os.path.exists(META_PATH) else 0
        }
    except Exception as e:
        return {
            "error": str(e),
            "total_vectors": 0,
            "total_metadata": 0,
            "index_file_exists": False,
            "metadata_file_exists": False,
            "storage_path": VECTOR_STORE_PATH
        }

def force_save():
    """Force save the current index state"""
    save_index()

def clear_corrupted_index():
    """Clear corrupted index files and start fresh"""
    global _index, _metadata
    
    lock_file = None
    try:
        lock_file = acquire_lock()
        
        # Remove corrupted files
        for file_path in [INDEX_PATH, META_PATH]:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️ Removed corrupted file: {file_path}")
        
        # Reset in-memory cache
        _index = faiss.IndexFlatL2(EMBED_DIM)
        _metadata = []
        
        print("✅ Cleared corrupted index, starting fresh")
        
    except Exception as e:
        print(f"❌ Error clearing corrupted index: {e}")
    finally:
        if lock_file:
            release_lock(lock_file)