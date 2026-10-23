"""Private scan-image storage on Supabase Storage."""
from __future__ import annotations

import os
from urllib.parse import quote

import httpx


class SupabaseStorage:
    def __init__(self):
        self.url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or ""
        self.bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "agritrace-scans")
        if not self.url or not self.key:
            raise RuntimeError("Set SUPABASE_URL and the backend-only SUPABASE_SERVICE_ROLE_KEY for scan image storage")
        self.client = httpx.Client(timeout=30, headers={
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        })

    def _request(self, method: str, path: str, **kwargs):
        try:
            response = self.client.request(method, f"{self.url}/storage/v1{path}", **kwargs)
        except httpx.HTTPError as exc:
            raise RuntimeError("Supabase Storage could not be reached") from exc
        if response.is_error:
            # Do not echo response bodies: storage errors may contain private details.
            raise RuntimeError(f"Supabase Storage request failed ({response.status_code})")
        return response

    def ensure_private_bucket(self, file_size_limit: int) -> None:
        response = self._request("GET", "/bucket")
        buckets = response.json()
        existing = next((item for item in buckets if item.get("name") == self.bucket), None)
        if existing:
            if existing.get("public"):
                raise RuntimeError(f"Supabase bucket {self.bucket!r} must be private")
            return
        try:
            created = self.client.post(
                f"{self.url}/storage/v1/bucket",
                json={"id": self.bucket, "name": self.bucket, "public": False,
                      "file_size_limit": file_size_limit, "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]},
            )
        except httpx.HTTPError as exc:
            raise RuntimeError("Supabase Storage could not be reached") from exc
        if created.is_error:
            # A concurrent worker may have created it after the list request.
            if created.status_code == 409:
                return
            raise RuntimeError(f"Unable to initialize the private Supabase Storage bucket ({created.status_code})")

    def upload(self, object_path: str, contents: bytes, content_type: str) -> None:
        safe_path = quote(object_path, safe="/")
        self._request("POST", f"/object/{quote(self.bucket, safe='')}/{safe_path}",
                      content=contents, headers={"Content-Type": content_type, "x-upsert": "false"})

    def download(self, object_path: str) -> bytes:
        safe_path = quote(object_path, safe="/")
        return self._request("GET", f"/object/{quote(self.bucket, safe='')}/{safe_path}").content

    def remove(self, object_paths: list[str]) -> None:
        if not object_paths:
            return
        self._request("DELETE", f"/object/{quote(self.bucket, safe='')}", json={"prefixes": object_paths})


_storage: SupabaseStorage | None = None


def get_storage() -> SupabaseStorage:
    global _storage
    if _storage is None:
        _storage = SupabaseStorage()
    return _storage
