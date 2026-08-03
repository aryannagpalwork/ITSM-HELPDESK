
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import asyncio
import httpx

async def test_auth_flow():
    base_url = "http://127.0.0.1:8000"
    
    print("=== Step 1: Login ===")
    login_response = httpx.post(
        f"{base_url}/auth/login",
        json={"email": "admin@enterprise.com", "password": "Password@123"},
        timeout=30.0
    )
    print(f"Login status: {login_response.status_code}")
    print(f"Login headers: {dict(login_response.headers)}")
    print(f"Login response: {login_response.text}")
    
    if login_response.status_code != 200:
        print("Login failed!")
        return
    
    token_data = login_response.json()
    access_token = token_data["access_token"]
    print(f"\nGot access token: {access_token[:50]}...")
    
    print("\n=== Step 2: Call /admin/users ===")
    admin_response = httpx.get(
        f"{base_url}/admin/users",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30.0
    )
    print(f"Admin users status: {admin_response.status_code}")
    print(f"Admin users headers: {dict(admin_response.headers)}")
    print(f"Admin users response: {admin_response.text}")

if __name__ == "__main__":
    asyncio.run(test_auth_flow())
