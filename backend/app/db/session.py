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
            if settings.ENVIRONMENT.lower() == "production":
                logger.warning(
                    "No MONGODB_URI provided in production environment. Backend running in in-memory fallback mode. "
                    "For persistent cloud storage, configure MONGODB_URI (e.g. MongoDB Atlas connection string)."
                )
            else:
                logger.info("No MONGODB_URI provided. Running backend in stateless/in-memory mode for local development.")
            return

        try:
            # Mask credentials in logs for security
            masked_uri = settings.MONGODB_URI
            if "@" in masked_uri:
                prefix = masked_uri.split("@")[0]
                suffix = masked_uri.split("@")[1]
                scheme = prefix.split("://")[0] if "://" in prefix else "mongodb"
                masked_uri = f"{scheme}://****:****@{suffix}"
            
            logger.info(f"Connecting to MongoDB at {masked_uri}...")
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000
            )
            # Ping database to confirm connection
            await self.client.admin.command('ping')
            self.db = self.client[settings.MONGODB_DB_NAME]
            self.is_connected = True
            logger.info(f"Connected to MongoDB database: '{settings.MONGODB_DB_NAME}'")
            # Ensure indexes are established asynchronously
            await self._ensure_indexes()
        except Exception as e:
            if settings.ENVIRONMENT.lower() == "production":
                logger.error(f"MongoDB connection failed in production: {e}. Active fallback: in-memory state.")
            else:
                logger.warning(f"MongoDB connection failed: {e}. Falling back to stateless local mode.")
            self.is_connected = False
            self.db = None

    async def _ensure_indexes(self):
        """Creates high-performance compound indexes for dataset-scoped querying and pagination."""
        if self.db is None:
            return
        try:
            # 1. Reconciliation Exceptions indexes
            exc_coll = self.db["reconciliation_exceptions"]
            await exc_coll.create_index([("dataset_id", 1), ("severity", 1)])
            await exc_coll.create_index([("dataset_id", 1), ("primary_exception_type", 1)])
            await exc_coll.create_index([("dataset_id", 1), ("status", 1)])
            await exc_coll.create_index([("dataset_id", 1), ("exception_id", 1)], unique=True)
            await exc_coll.create_index([("dataset_id", 1), ("payment_id", 1)])

            # 2. Payments & Financial Transactions indexes
            payments_coll = self.db["payments"]
            await payments_coll.create_index([("dataset_id", 1), ("payment_id", 1)])
            await payments_coll.create_index([("dataset_id", 1), ("payment_status", 1)])

            # 3. Settlements, Refunds, Fees indexes
            await self.db["settlements"].create_index([("dataset_id", 1), ("payment_id", 1)])
            await self.db["refunds"].create_index([("dataset_id", 1), ("payment_id", 1)])
            await self.db["fees"].create_index([("dataset_id", 1), ("payment_id", 1)])

            # 4. Summaries & Upload sessions & Audit events
            await self.db["exception_summaries"].create_index([("dataset_id", 1)], unique=True)
            await self.db["reconciliation_summaries"].create_index([("dataset_id", 1)], unique=True)
            await self.db["upload_sessions"].create_index([("upload_id", 1)], unique=True)
            await self.db["investigation_audit_events"].create_index([("dataset_id", 1), ("action", 1)])
            logger.info("Successfully ensured MongoDB indexes for all financial collections.")
        except Exception as e:
            logger.warning(f"Index creation encountered a non-fatal warning: {e}")

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
