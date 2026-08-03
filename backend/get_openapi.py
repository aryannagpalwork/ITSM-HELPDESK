
import httpx
import json
from pathlib import Path

resp = httpx.get("http://127.0.0.1:8000/openapi.json")
data = resp.json()
Path("openapi.json").write_text(json.dumps(data, indent=2))
print("Saved to openapi.json")
