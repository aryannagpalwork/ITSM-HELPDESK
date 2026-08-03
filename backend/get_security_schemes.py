
import httpx

resp = httpx.get("http://127.0.0.1:8000/openapi.json")
data = resp.json()

print("Components keys:", list(data.get("components", {}).keys()))
print("Security schemes:", data.get("components", {}).get("securitySchemes", "NOT FOUND"))
print("\nChecking GET /admin/users security:")
print(data["paths"]["/admin/users"]["get"].get("security", "NOT FOUND"))
