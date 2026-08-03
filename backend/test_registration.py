
import httpx
import asyncio

BASE_URL = "http://localhost:8000"


async def test_registration():
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=" * 80)
        print("Test 1: Register new employee (john.doe@example.com)")
        print("=" * 80)
        register_response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "full_name": "John Doe",
                "email": "john.doe@example.com",
                "password": "SecurePass123!",
                "role": "Employee",
            },
        )
        print(f"Register status: {register_response.status_code}")
        if register_response.status_code == 201:
            print("✅ Registration successful!")
            data = register_response.json()
            print(f"  User email: {data['user']['email']}")
            print(f"  User role: {data['user']['role']}")
            print(f"  Access token received: {len(data['access_token']) > 0}")
        else:
            print(f"❌ Registration failed: {register_response.text}")
            return False

        print("\n" + "=" * 80)
        print("Test 2: Login as John Doe")
        print("=" * 80)
        login_response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": "john.doe@example.com",
                "password": "SecurePass123!",
            },
        )
        print(f"Login status: {login_response.status_code}")
        if login_response.status_code == 200:
            print("✅ Login successful!")
            data = login_response.json()
            print(f"  User email: {data['user']['email']}")
            print(f"  User role: {data['user']['role']}")
        else:
            print(f"❌ Login failed: {login_response.text}")
            return False

        print("\n" + "=" * 80)
        print("Test 3: Register another employee (jane.smith@example.com)")
        print("=" * 80)
        register_response2 = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "full_name": "Jane Smith",
                "email": "jane.smith@example.com",
                "password": "AnotherPass456!",
                "role": "Employee",
            },
        )
        print(f"Register status: {register_response2.status_code}")
        if register_response2.status_code == 201:
            print("✅ Registration successful!")
            data = register_response2.json()
            print(f"  User email: {data['user']['email']}")
            print(f"  User role: {data['user']['role']}")
        else:
            print(f"❌ Registration failed: {register_response2.text}")
            return False

        print("\n" + "=" * 80)
        print("Test 4: Login as Jane Smith")
        print("=" * 80)
        login_response2 = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": "jane.smith@example.com",
                "password": "AnotherPass456!",
            },
        )
        print(f"Login status: {login_response2.status_code}")
        if login_response2.status_code == 200:
            print("✅ Login successful!")
            data = login_response2.json()
            print(f"  User email: {data['user']['email']}")
            print(f"  User role: {data['user']['role']}")
        else:
            print(f"❌ Login failed: {login_response2.text}")
            return False

        print("\n" + "=" * 80)
        print("Test 5: Try to register with duplicate email (john.doe@example.com)")
        print("=" * 80)
        duplicate_response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "full_name": "Duplicate John",
                "email": "john.doe@example.com",
                "password": "SomePass789!",
                "role": "Employee",
            },
        )
        print(f"Register status: {duplicate_response.status_code}")
        if duplicate_response.status_code == 400:
            print("✅ Duplicate email check works!")
        else:
            print(f"❌ Duplicate check failed: {duplicate_response.text}")
            return False

        print("\n" + "=" * 80)
        print("✅ All tests passed!")
        print("=" * 80)
        return True


if __name__ == "__main__":
    asyncio.run(test_registration())

