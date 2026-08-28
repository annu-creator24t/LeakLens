import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("leaklens.db")


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    is_connected: bool = False

    async def connect(self):
        """Initializes database connection if MONGODB_URI is provided."""
        if not settings.MONGODB_URI:
            logger.info("No MONGODB_URI provided. Running backend in stateless/in-memory mode for local development.")
            return

        try:
            logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2000
            )
            # Ping database to confirm connection
            await self.client.admin.command('ping')
            self.db = self.client[settings.MONGODB_DB_NAME]
            self.is_connected = True
            logger.info(f"Connected to MongoDB database: '{settings.MONGODB_DB_NAME}'")
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}. Falling back to stateless local mode.")
            self.is_connected = False
            self.db = None

    async def disconnect(self):
        """Closes the MongoDB connection."""
        if self.client:
            self.client.close()
            self.is_connected = False
            logger.info("MongoDB connection closed.")

    def get_db(self) -> Optional[AsyncIOMotorDatabase]:
        """Returns the active MongoDB database instance or None."""
        return self.db


db_manager = DatabaseManager()
