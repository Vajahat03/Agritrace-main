import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel

logger = logging.getLogger("agritrace.database.indexes")

async def ensure_indexes(db: AsyncIOMotorDatabase):
    """
    Creates necessary unique constraints and query indexes on MongoDB collections.
    Idempotent: safe to run on every application startup.
    """
    if db is None:
        return

    try:
        # 1. Users collection
        user_indexes = [
            IndexModel([("uid", ASCENDING)], unique=True, name="idx_user_uid_unique"),
            IndexModel([("role", ASCENDING)], name="idx_user_role"),
            IndexModel([("email", ASCENDING)], sparse=True, name="idx_user_email"),
        ]
        await db["users"].create_indexes(user_indexes)

        # 2. Farms collection
        farm_indexes = [
            IndexModel([("farmer_id", ASCENDING)], name="idx_farm_farmer_id"),
        ]
        await db["farms"].create_indexes(farm_indexes)

        # 3. Crops collection
        crop_indexes = [
            IndexModel([("farmer_id", ASCENDING)], name="idx_crop_farmer_id"),
            IndexModel([("farmer_id", ASCENDING), ("status", ASCENDING)], name="idx_crop_farmer_status"),
        ]
        await db["crops"].create_indexes(crop_indexes)

        # 4. Batches collection
        batch_indexes = [
            IndexModel([("batch_code", ASCENDING)], unique=True, name="idx_batch_code_unique"),
            IndexModel([("farmer_id", ASCENDING)], name="idx_batch_farmer_id"),
            IndexModel([("farmer_id", ASCENDING), ("current_status", ASCENDING)], name="idx_batch_farmer_status"),
        ]
        await db["batches"].create_indexes(batch_indexes)

        # 5. Vendor Inventory collection
        inventory_indexes = [
            IndexModel([("vendor_id", ASCENDING)], name="idx_inventory_vendor_id"),
            IndexModel([("vendor_id", ASCENDING), ("status", ASCENDING)], name="idx_inventory_vendor_status"),
        ]
        await db["vendor_inventory"].create_indexes(inventory_indexes)

        # 6. Inventory Adjustments (Audit Trail)
        adjustment_indexes = [
            IndexModel([("vendor_id", ASCENDING)], name="idx_adjustment_vendor_id"),
            IndexModel([("inventory_id", ASCENDING)], name="idx_adjustment_inv_id"),
            IndexModel([("created_at", DESCENDING)], name="idx_adjustment_created_at"),
        ]
        await db["inventory_adjustments"].create_indexes(adjustment_indexes)

        # 7. Fertilizer Applications
        fertilizer_indexes = [
            IndexModel([("farmer_id", ASCENDING)], name="idx_fertilizer_farmer_id"),
            IndexModel([("crop_id", ASCENDING)], name="idx_fertilizer_crop_id"),
            IndexModel([("farmer_id", ASCENDING), ("crop_id", ASCENDING)], name="idx_fertilizer_farmer_crop"),
        ]
        await db["fertilizer_applications"].create_indexes(fertilizer_indexes)

        # 8. AI Workflows
        workflow_indexes = [
            IndexModel([("workflow_id", ASCENDING)], unique=True, name="idx_workflow_id_unique"),
            IndexModel([("user_id", ASCENDING)], name="idx_workflow_user_id"),
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_workflow_user_created"),
        ]
        await db["ai_workflows"].create_indexes(workflow_indexes)

        # 9. SmartBag Batches
        smartbag_indexes = [
            IndexModel([("batch_id", ASCENDING)], unique=True, name="idx_smartbag_batch_id_unique"),
            IndexModel([("user_id", ASCENDING)], name="idx_smartbag_user_id"),
            IndexModel([("user_id", ASCENDING), ("current_status", ASCENDING)], name="idx_smartbag_user_status"),
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_smartbag_user_created"),
        ]
        await db["smartbag_batches"].create_indexes(smartbag_indexes)

        # 10. SmartBag Reminders (Idempotent per batch_id + due_date)
        reminder_indexes = [
            IndexModel([("reminder_key", ASCENDING)], unique=True, name="idx_reminder_key_unique"),
            IndexModel([("user_id", ASCENDING)], name="idx_reminder_user_id"),
            IndexModel([("batch_id", ASCENDING)], name="idx_reminder_batch_id"),
            IndexModel([("due_date", ASCENDING), ("status", ASCENDING)], name="idx_reminder_due_status"),
        ]
        await db["smartbag_reminders"].create_indexes(reminder_indexes)

        # 11. User Notifications
        notification_indexes = [
            IndexModel([("notification_id", ASCENDING)], unique=True, name="idx_notification_id_unique"),
            IndexModel([("user_id", ASCENDING)], name="idx_notification_user_id"),
            IndexModel([("user_id", ASCENDING), ("is_read", ASCENDING)], name="idx_notification_user_read"),
            IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="idx_notification_user_created"),
        ]
        await db["user_notifications"].create_indexes(notification_indexes)

        logger.info("MongoDB Atlas indexes verified and initialized.")

    except Exception as e:
        logger.warning("Could not initialize MongoDB indexes: %s", e)
