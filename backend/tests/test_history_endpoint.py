import asyncio
from datetime import datetime

from bson import ObjectId

from app.api.chat import get_chat_history


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    async def to_list(self, length=None):
        return self._docs
    def sort(self, key):
        # naive: assume docs already in chronological order
        return self


class FakeCollection:
    def __init__(self, docs, key_name=None):
        self.docs = docs
        self.key_name = key_name

    async def find_one(self, query):
        # simple match on provided key
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                return d
        return None

    def find(self, query):
        results = [d for d in self.docs if all(d.get(k) == v for k, v in query.items())]
        return FakeCursor(results)


class FakeDB(dict):
    def __init__(self, conv_docs, history_docs):
        super().__init__()
        self['ai_conversations'] = FakeCollection(conv_docs)
        self['chat_history'] = FakeCollection(history_docs)


def _walk_contains_objectid(obj) -> bool:
    from bson import ObjectId
    if isinstance(obj, ObjectId):
        return True
    if isinstance(obj, dict):
        return any(_walk_contains_objectid(v) for v in obj.values())
    if isinstance(obj, (list, tuple)):
        return any(_walk_contains_objectid(v) for v in obj)
    return False


def test_get_chat_history_sanitizes_objectids():
    session_id = 'sess-123'
    conv_id = ObjectId()
    user_id = ObjectId()
    convo = {
        '_id': conv_id,
        'conversation_id': session_id,
        'conversation_status': 'ACTIVE',
        'user_id': user_id,
        'started_at': datetime.utcnow(),
    }

    history = [
        {'_id': ObjectId(), 'session_id': session_id, 'role': 'user', 'message': 'hello', 'created_at': datetime.utcnow()},
        {'_id': ObjectId(), 'session_id': session_id, 'role': 'assistant', 'message': 'hi', 'created_at': datetime.utcnow()},
    ]

    db = FakeDB([convo], history)

    result = asyncio.run(get_chat_history(session_id, db, current_user={'id': str(user_id)}))

    assert result.get('session_id') == session_id
    assert 'messages' in result
    assert len(result['messages']) == 2
    # Ensure no ObjectId instances in the returned structure
    assert not _walk_contains_objectid(result)
