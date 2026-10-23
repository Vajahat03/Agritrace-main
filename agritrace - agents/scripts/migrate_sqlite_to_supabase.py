"""Copy the local AgriTrace SQLite records and scan images into Supabase.

This is an explicit one-time operation. It never changes or deletes the local
SQLite database or image files. Run it only after configuring the Supabase
connection and reviewing the target project.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv

# Running ``python scripts/migrate_sqlite_to_supabase.py`` puts only the
# scripts directory on sys.path; add the repository root for backend imports.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env", override=True)
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.security import AuthStore
from backend.supabase_storage import get_storage
from backend.workflow import ensure_schema


TABLES = (
    "users", "workspaces", "workspace_members", "sessions", "farms", "produce",
    "produce_scans", "shelf_life_predictions", "agent_runs", "market_snapshots",
)


def migrate(source_path: Path) -> dict[str, int]:
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite source database not found: {source_path}")
    store = AuthStore()
    ensure_schema(store)
    source_uri = source_path.resolve().as_uri() + "?mode=ro"
    source = sqlite3.connect(source_uri, uri=True)
    source.row_factory = sqlite3.Row
    uploaded: list[str] = []
    try:
        source_tables = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        rows_by_table: dict[str, list[dict]] = {}
        image_root = (PROJECT_ROOT / "backend" / "uploads").resolve()
        image_rows = []
        for table in TABLES:
            if table not in source_tables:
                rows_by_table[table] = []
                continue
            rows_by_table[table] = [dict(row) for row in source.execute(f'SELECT * FROM "{table}"')]
        for row in rows_by_table.get("produce_scans", []):
            old_key = row.get("image_key")
            if not old_key:
                continue
            workspace_id = row.get("workspace_id")
            filename = Path(str(old_key)).name
            if not workspace_id or filename != old_key or filename in {".", ".."}:
                raise RuntimeError("A scan image path in SQLite is not a safe workspace-local filename")
            source_image = (image_root / str(workspace_id) / filename).resolve()
            if source_image.parent != (image_root / str(workspace_id)).resolve() or not source_image.is_file():
                raise FileNotFoundError(f"A referenced scan image is missing from the local uploads folder: {filename}")
            image_rows.append((row, source_image, f"{workspace_id}/{filename}"))

        if image_rows:
            storage = get_storage()
            storage.ensure_private_bucket(8 * 1024 * 1024)
            for row, source_image, cloud_key in image_rows:
                data = source_image.read_bytes()
                content_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(source_image.suffix.lower())
                if content_type is None:
                    raise RuntimeError(f"Unsupported scan image type in local uploads: {source_image.name}")
                storage.upload(cloud_key, data, content_type)
                uploaded.append(cloud_key)
                row["image_key"] = cloud_key

        imported: dict[str, int] = {}
        with store.connect() as target:
            for table in TABLES:
                rows = rows_by_table.get(table, [])
                if not rows:
                    imported[table] = 0
                    continue
                target_columns = {r["column_name"] for r in target.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?",
                    (table,),
                )}
                count = 0
                for row in rows:
                    columns = [column for column in row if column in target_columns]
                    if not columns:
                        continue
                    quoted = ",".join(f'"{column}"' for column in columns)
                    placeholders = ",".join("?" for _ in columns)
                    boolean_columns = {
                        "users": {"is_active"},
                        "shelf_life_predictions": {"development_only", "real_world_validated"},
                    }.get(table, set())
                    values = tuple(bool(row[column]) if column in boolean_columns and row[column] is not None else row[column]
                                   for column in columns)
                    result = target.execute(
                        f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
                        values,
                    )
                    count += max(0, result.rowcount)
                imported[table] = count
        return imported | {"scan_images": len(uploaded)}
    except Exception:
        if uploaded:
            try:
                get_storage().remove(uploaded)
            except Exception:
                pass
        raise
    finally:
        source.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=Path("backend/agritrace.sqlite3"),
                        help="Local source file (default: backend/agritrace.sqlite3)")
    args = parser.parse_args()
    summary = migrate(args.sqlite)
    print("Migration finished; local SQLite data and files were left unchanged.")
    for name, count in summary.items():
        print(f"{name}: {count} copied")


if __name__ == "__main__":
    main()
