import logging
import re
import asyncio
from typing import Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from ..core.config import settings

logger = logging.getLogger("agritrace.database")

def sanitize_mongodb_uri(uri: str) -> str:
    """
    Sanitizes MongoDB connection string by masking user credentials.
    Prevents credentials from ever appearing in logs, errors, or API responses.
    """
    if not uri:
        return ""
    return re.sub(r"://([^:@]+):([^@]+)@", r"://\1:***@", uri)

class MongoDBManager:
    """
    Manages MongoDB Atlas asynchronous connection lifecycle, connection pooling,
    health verification, and graceful fallback handling.
    """
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._connected: bool = False
        self._connection_error: Optional[str] = None

    async def connect(self) -> bool:
        """
        Connects to MongoDB Atlas using Motor with connection pooling and timeouts.
        Fails safely if credentials are not configured or Atlas is unreachable.
        """
        if not settings.MONGODB_URI:
            self._connected = False
            self.client = None
            self.db = None
            self._connection_error = "MONGODB_URI not configured in environment"
            logger.info("MongoDB URI not set. Operating with local store resilience.")
            return False

        sanitized = sanitize_mongodb_uri(settings.MONGODB_URI)
        logger.info("Initiating connection to MongoDB Atlas at %s...", sanitized)

        # Bounded server selection timeout to allow TLS handshake with Atlas
        timeout_ms = max(int(settings.MONGODB_TIMEOUT_MS or 30000), 30000)

        try:
            client_kwargs = {
                "serverSelectionTimeoutMS": timeout_ms,
                "connectTimeoutMS": timeout_ms,
                "socketTimeoutMS": timeout_ms,
                "minPoolSize": settings.MONGODB_MIN_POOL_SIZE,
                "maxPoolSize": settings.MONGODB_MAX_POOL_SIZE,
                "appname": "AgriTrace-Backend",
            }
            try:
                import certifi
                client_kwargs["tlsCAFile"] = certifi.where()
            except Exception:
                pass

            client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                **client_kwargs,
            )
            db = client[settings.MONGODB_DATABASE]

            # Fast ping with timeout
            await asyncio.wait_for(db.command("ping"), timeout=timeout_ms / 1000.0)
            self.client = client
            self.db = db
            self._connected = True
            self._connection_error = None
            logger.info("Successfully connected to MongoDB Atlas database '%s'", settings.MONGODB_DATABASE)
            return True

        except (ServerSelectionTimeoutError, ConnectionFailure, asyncio.TimeoutError) as e:
            self._connected = False
            self.db = None
            if self.client is not None:
                try:
                    self.client.close()
                except Exception:
                    pass
                self.client = None
            self._connection_error = f"Database unreachable: connection timed out after {timeout_ms}ms"
            logger.warning("MongoDB Atlas unreachable (%s). Resilient fallback active.", self._connection_error)
            return False
        except Exception as e:
            self._connected = False
            self.db = None
            if self.client is not None:
                try:
                    self.client.close()
                except Exception:
                    pass
                self.client = None
            self._connection_error = f"Connection failed: {e}"
            logger.warning("MongoDB connection error: %s", e)
            return False

    async def disconnect(self):
        """
        Gracefully closes MongoDB connection pool.
        """
        if self.client is not None:
            logger.info("Closing MongoDB Atlas connection pool...")
            try:
                self.client.close()
            except Exception:
                pass
            self.client = None
            self.db = None
            self._connected = False
            logger.info("MongoDB connection closed.")

    async def ping(self) -> Tuple[bool, str]:
        """
        Performs a lightweight ping check on the database.
        Returns (is_healthy, status_message).
        """
        if not self._connected or self.db is None:
            return False, self._connection_error or "MongoDB Atlas disconnected"

        try:
            await asyncio.wait_for(self.db.command("ping"), timeout=1.5)
            return True, "MongoDB Atlas connection active and responsive"
        except Exception as e:
            self._connected = False
            return False, "Database ping failed"

    def is_connected(self) -> bool:
        return self._connected

    def get_database(self) -> Optional[AsyncIOMotorDatabase]:
        if not self._connected or self.db is None:
            return None
        return self.db

mongodb = MongoDBManager()
