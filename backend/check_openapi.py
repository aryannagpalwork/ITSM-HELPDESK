
import sys
import os

# Add the app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

from app.main import app

# Get the OpenAPI schema
openapi_schema = app.openapi()

# Check the security schemes
print("Security schemes in OpenAPI spec:")
print(openapi_schema.get("components", {}).get("securitySchemes", {}))
print()

# Check one of the admin endpoints to see if security is applied
print("Checking /admin/users endpoint:")
paths = openapi_schema.get("paths", {})
admin_users = paths.get("/admin/users", {})
get_admin_users = admin_users.get("get", {})
print("Security:", get_admin_users.get("security"))
print()

print("OpenAPI schema generated successfully!")

