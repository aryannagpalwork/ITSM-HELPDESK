import sys, json, asyncio
from pathlib import Path
sys.path.insert(0, '.')
from app.database.mongodb import get_database
from app.rag.vector_store import FAISSVectorStore
from app.rag.embedding_provider import EmbeddingProviderFactory
from app.rag.retriever import FAISSRetriever, RetrievalConfig

async def main():
    db = get_database()
    docs = await db['knowledge_documents'].count_documents({})
    chunks = await db['document_chunks'].count_documents({})
    print('KNOWLEDGE_DOCUMENTS', docs)
    print('DOCUMENT_CHUNKS', chunks)

    docs_list = await db['knowledge_documents'].find({}).limit(5).to_list(length=5)
    print('DOC_SAMPLE', json.dumps(docs_list, default=str))
    chunks_list = await db['document_chunks'].find({}).limit(5).to_list(length=5)
    print('CHUNK_SAMPLE', json.dumps(chunks_list, default=str))

    provider = EmbeddingProviderFactory.create('openai')
    print('EMBEDDING_MODEL', provider.get_model_name())
    vec = FAISSVectorStore(dimension=provider.get_embedding_dimension(), storage_path=Path('vector_store'))
    vec.load()
    stats = vec.get_stats()
    print('VECTOR_STATS', stats)
    print('INDEX_NTOTAL', vec._index.ntotal)
    print('INDEX_CHUNKS', len(vec._chunks))
    print('INDEX_FILES', Path('vector_store/faiss.index').exists(), Path('vector_store/chunks.pkl').exists())

    query = 'My printer is not working'
    query_embedding = provider.embed(query).embedding
    print('QUERY_EMBEDDING_LEN', len(query_embedding))

    retriever = FAISSRetriever(embedding_provider=provider, vector_store=vec, config=RetrievalConfig(top_k=10, similarity_threshold=0.5))
    context = retriever.retrieve(query, RetrievalConfig(top_k=10, similarity_threshold=0.5))
    print('RETRIEVED_TOTAL', context.total_retrieved)
    for i, res in enumerate(context.search_results[:10], 1):
        chunk = res.chunk
        doc = await db['knowledge_documents'].find_one({'_id': chunk.document_id})
        print('TOP', i, 'SIM', res.similarity_score, 'DOC', doc['filename'] if doc else None, 'HEAD', chunk.heading, 'TEXT', chunk.text[:250])

asyncio.run(main())
