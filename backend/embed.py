# backend/embed.py
import os
import faiss
import pickle
import numpy as np
from openai import AzureOpenAI
from typing import List
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

EMBED_DIM = 1536
INDEX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "vector_store.faiss"))
META_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "vector_meta.pkl"))

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=f"https://{os.getenv('AZURE_RESOURCE_NAME')}.openai.azure.com/",
    api_version=os.getenv("AZURE_API_VERSION")
)

# Load or create FAISS index and metadata
if os.path.exists(INDEX_PATH):
    index = faiss.read_index(INDEX_PATH)
    with open(META_PATH, "rb") as f:
        metadata = pickle.load(f)
else:
    index = faiss.IndexFlatL2(EMBED_DIM)
    metadata = []


def embed_text(text: str) -> List[float]:
    response = client.embeddings.create(
        model=os.getenv("AZURE_EMBEDDING_DEPLOYMENT_ID"),  # use deployment name
        input=text
    )
    return response.data[0].embedding

def add_document(text: str, source_path: str):
    embedding = embed_text(text)
    index.add(np.array([embedding]).astype('float32'))
    metadata.append({"text": text, "source": source_path})

    faiss.write_index(index, INDEX_PATH)
    with open(META_PATH, "wb") as f:
        pickle.dump(metadata, f)


def get_relevant_chunks(query: str, top_k=5) -> str:
    if index.ntotal == 0:
        return ""

    query_vec = embed_text(query)
    D, I = index.search(np.array([query_vec]).astype('float32'), top_k)
    return "\n---\n".join([metadata[i]["text"] for i in I[0] if i < len(metadata)])
