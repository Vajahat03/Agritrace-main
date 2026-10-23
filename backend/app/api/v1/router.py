from fastapi import APIRouter
from .endpoints import health, auth, farmers, vendors, customers, admin, ai, smartbag, notifications, news

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(farmers.router, prefix="/farmer")
api_router.include_router(vendors.router, prefix="/vendor")
api_router.include_router(customers.router, prefix="/customer")
api_router.include_router(admin.router, prefix="/admin")
api_router.include_router(ai.router, prefix="/ai")
api_router.include_router(smartbag.router, prefix="/smartbag")
api_router.include_router(notifications.router, prefix="/notifications")
api_router.include_router(news.router, prefix="/news")


