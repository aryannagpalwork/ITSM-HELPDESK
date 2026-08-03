from typing import Annotated

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongodb import get_database

DatabaseSession = Annotated[AsyncIOMotorDatabase, Depends(get_database)]
