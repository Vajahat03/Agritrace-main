from typing import Optional
from fastapi import APIRouter, Query
from ....services.news_service import fetch_agricultural_news

router = APIRouter()

@router.get("/farm-topics", tags=["Agricultural News & Topics"])
async def get_farm_topics(
    query: Optional[str] = Query(None, description="Search term for farm topics"),
    category: Optional[str] = Query(None, description="Category filter (e.g. Technology, Market, Pest Control)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
):
    """
    Public agricultural news and farm-related topics feed for farmers and vendors.
    Powered by News API with curated agricultural topic fallbacks.
    """
    return await fetch_agricultural_news(
        query=query,
        category=category,
        page=page,
        page_size=page_size,
    )
