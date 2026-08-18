import pytest

from app.api.documents import delete_document


class FakeKnowledgeDocumentsCollection:
    def __init__(self):
        self.deleted = None

    async def find_one(self, query):
        return {"_id": 1, "title": "Example", "status": "processed"}

    async def delete_one(self, query):
        self.deleted = query
        return None


class FakeEmbeddingService:
    def __init__(self, db):
        self.db = db

    async def delete_document(self, document_id):
        self.db["deleted_document_id"] = document_id

    def save_index(self):
        self.db["index_saved"] = True


@pytest.mark.asyncio
async def test_delete_document_handles_missing_file_path(monkeypatch):
    db = {"knowledge_documents": FakeKnowledgeDocumentsCollection(), "deleted_document_id": None, "index_saved": False}

    monkeypatch.setattr("app.api.documents.EmbeddingService", FakeEmbeddingService)

    await delete_document(document_id=1, db=db, current_user={"internal_role": "admin", "role": "Administrator"})

    assert db["deleted_document_id"] == 1
    assert db["index_saved"] is True
    assert db["knowledge_documents"].deleted == {"_id": 1}
