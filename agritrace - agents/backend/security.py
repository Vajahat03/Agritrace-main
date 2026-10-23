"""First-party authentication and workspace-scoped Supabase Postgres storage."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit

import psycopg

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field


ROLES = frozenset({"admin", "farmer", "vendor", "customer"})
SELF_SERVICE_ROLES = frozenset({"farmer", "vendor", "customer"})
SESSION_COOKIE = "agritrace_session"
SESSION_TTL_HOURS = max(1, int(os.getenv("SESSION_TTL_HOURS", "168")))
APP_ENV = os.getenv("APP_ENV", "development").lower()
COOKIE_SECURE = APP_ENV == "production" or os.getenv("SESSION_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
AUTH_TOKEN_PEPPER = os.getenv("AUTH_TOKEN_PEPPER", "development-only-change-me")
if APP_ENV == "production" and len(AUTH_TOKEN_PEPPER.encode("utf-8")) < 32:
    raise RuntimeError("Production requires AUTH_TOKEN_PEPPER with at least 32 bytes")
if SESSION_TTL_HOURS > 720:
    raise RuntimeError("SESSION_TTL_HOURS cannot exceed 720 hours")


def _token_digest(token: str) -> str:
    return hmac.new(AUTH_TOKEN_PEPPER.encode("utf-8"), token.encode("utf-8"), hashlib.sha256).hexdigest()


_DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$" + ("00" * 16) + ("00" * 32)


def _postgres_url(database_url: str | None = None) -> str:
    value = database_url or os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError(
            "Supabase Postgres is required. Set SUPABASE_DATABASE_URL to the "
            "Session Pooler connection string from Supabase > Connect."
        )
    parsed = urlsplit(value)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise RuntimeError("SQLite is disabled. SUPABASE_DATABASE_URL must be a PostgreSQL connection string.")
    if not parsed.hostname or not parsed.username or not parsed.password or not parsed.path.strip("/"):
        raise RuntimeError("SUPABASE_DATABASE_URL must include its supplied host, username, password, and database name.")
    if "sslmode=" not in parsed.query:
        value += "&sslmode=require" if parsed.query else "?sslmode=require"
    return value


class _HybridRow(dict):
    """Mapping row with SQLite-compatible integer column access."""
    def __getitem__(self, key):
        if isinstance(key, int):
            key = tuple(self.keys())[key]
        return super().__getitem__(key)


def _hybrid_row(cursor):
    if cursor.description is None:
        return lambda values: values
    names = [column.name for column in cursor.description]
    return lambda values: _HybridRow(zip(names, values))


class _PostgresConnection:
    """Small adapter preserving the existing parameterized query interface."""
    is_postgres = True

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql: str, params=()):
        # Project queries use positional qmark parameters. PostgreSQL uses %s.
        return self._conn.execute(sql.replace("?", "%s"), params)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        try:
            return self._conn.__exit__(exc_type, exc, traceback)
        finally:
            self._conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _ClosingConnection(sqlite3.Connection):
    def __exit__(self, exc_type, exc, traceback):
        try:
            return super().__exit__(exc_type, exc, traceback)
        finally:
            self.close()


class AuthStore:
    """Supabase Postgres store for identity, sessions, workspaces and records.

    ``database_path`` exists only for isolated legacy unit-test fixtures. The
    running application accepts PostgreSQL URLs only and never falls back to SQLite.
    """

    def __init__(self, database_url: str | None = None, *, database_path: str | Path | None = None):
        self._test_sqlite = database_path is not None
        if self._test_sqlite:
            requested_path = str(database_path)
            self.uri = requested_path == ":memory:"
            self.path = f"file:agritrace-{uuid.uuid4()}?mode=memory&cache=shared" if self.uri else Path(requested_path)
            self._anchor = None
            if self.uri:
                self._anchor = sqlite3.connect(self.path, uri=True, check_same_thread=False, factory=_ClosingConnection)
                self._anchor.execute("PRAGMA foreign_keys = ON")
            else:
                self.path.parent.mkdir(parents=True, exist_ok=True)
            self.database_url = None
        else:
            self.uri = False
            self.path = None
            self._anchor = None
            self.database_url = _postgres_url(database_url)
        self.initialize()

    def connect(self):
        if self._test_sqlite:
            conn = sqlite3.connect(str(self.path), timeout=10, check_same_thread=False,
                                   factory=_ClosingConnection, uri=self.uri)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA busy_timeout = 10000")
            return conn
        conn = psycopg.connect(self.database_url, connect_timeout=10, row_factory=_hybrid_row)
        return _PostgresConnection(conn)

    def initialize(self) -> None:
        if not self._test_sqlite:
            self._initialize_postgres()
            return
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    role TEXT NOT NULL CHECK (role IN ('admin','farmer','vendor','customer')),
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    phone TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workspace_members (
                    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role TEXT NOT NULL CHECK (role IN ('admin','farmer','vendor','customer')),
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (workspace_id, user_id)
                );
                CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    last_used_at TEXT NOT NULL,
                    revoked_at TEXT,
                    user_agent TEXT,
                    FOREIGN KEY (workspace_id, user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
                CREATE TABLE IF NOT EXISTS farms (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (workspace_id, owner_user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_farms_workspace_owner ON farms(workspace_id, owner_user_id);
                CREATE TABLE IF NOT EXISTS produce (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    farm_id TEXT REFERENCES farms(id) ON DELETE SET NULL,
                    produce_type TEXT NOT NULL,
                    quantity_kg REAL,
                    harvest_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (workspace_id, owner_user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_produce_workspace_owner ON produce(workspace_id, owner_user_id);
                CREATE TABLE IF NOT EXISTS produce_scans (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    produce_id TEXT NOT NULL REFERENCES produce(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    FOREIGN KEY (workspace_id, owner_user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS shelf_life_predictions (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    produce_id TEXT REFERENCES produce(id) ON DELETE CASCADE,
                    model_name TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    predicted_days REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    input_provenance_json TEXT NOT NULL,
                    development_only INTEGER NOT NULL DEFAULT 1,
                    real_world_validated INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (workspace_id, owner_user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_predictions_workspace_owner
                    ON shelf_life_predictions(workspace_id, owner_user_id);
                CREATE TABLE IF NOT EXISTS agent_runs (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    owner_user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    FOREIGN KEY (workspace_id, owner_user_id)
                        REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_owner
                    ON agent_runs(workspace_id, owner_user_id);
                CREATE TRIGGER IF NOT EXISTS enforce_produce_farm_owner_insert
                BEFORE INSERT ON produce
                WHEN NEW.farm_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM farms f WHERE f.id=NEW.farm_id
                      AND f.workspace_id=NEW.workspace_id AND f.owner_user_id=NEW.owner_user_id
                )
                BEGIN SELECT RAISE(ABORT, 'farm must belong to the same workspace and owner'); END;
                CREATE TRIGGER IF NOT EXISTS enforce_produce_farm_owner_update
                BEFORE UPDATE OF farm_id,workspace_id,owner_user_id ON produce
                WHEN NEW.farm_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM farms f WHERE f.id=NEW.farm_id
                      AND f.workspace_id=NEW.workspace_id AND f.owner_user_id=NEW.owner_user_id
                )
                BEGIN SELECT RAISE(ABORT, 'farm must belong to the same workspace and owner'); END;
                CREATE TRIGGER IF NOT EXISTS enforce_scan_produce_owner_insert
                BEFORE INSERT ON produce_scans
                WHEN NOT EXISTS (
                    SELECT 1 FROM produce p WHERE p.id=NEW.produce_id
                      AND p.workspace_id=NEW.workspace_id AND p.owner_user_id=NEW.owner_user_id
                )
                BEGIN SELECT RAISE(ABORT, 'produce must belong to the same workspace and owner'); END;
                CREATE TRIGGER IF NOT EXISTS enforce_prediction_produce_owner_insert
                BEFORE INSERT ON shelf_life_predictions
                WHEN NEW.produce_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM produce p WHERE p.id=NEW.produce_id
                      AND p.workspace_id=NEW.workspace_id AND p.owner_user_id=NEW.owner_user_id
                )
                BEGIN SELECT RAISE(ABORT, 'produce must belong to the same workspace and owner'); END;
            """)

    def _initialize_postgres(self) -> None:
        statements = [
            """CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('admin','farmer','vendor','customer')),
                full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""",
            "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
            """CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)""",
            """CREATE TABLE IF NOT EXISTS workspace_members (
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('admin','farmer','vendor','customer')),
                created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,user_id))""",
            "CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)",
            """CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE, expires_at DOUBLE PRECISION NOT NULL,
                created_at TEXT NOT NULL, last_used_at TEXT NOT NULL, revoked_at TEXT, user_agent TEXT,
                FOREIGN KEY(workspace_id,user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)",
            """CREATE TABLE IF NOT EXISTS farms (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
                name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', area TEXT NOT NULL DEFAULT '',
                soil_info TEXT NOT NULL DEFAULT '',
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE,
                UNIQUE(id,workspace_id,owner_user_id))""",
            "CREATE INDEX IF NOT EXISTS idx_farms_workspace_owner ON farms(workspace_id,owner_user_id)",
            """CREATE TABLE IF NOT EXISTS produce (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
                farm_id TEXT, produce_type TEXT NOT NULL, quantity_kg DOUBLE PRECISION, harvest_at TEXT,
                created_at TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', updated_at TEXT,
                quantity_value DOUBLE PRECISION,
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE,
                FOREIGN KEY(farm_id,workspace_id,owner_user_id) REFERENCES farms(id,workspace_id,owner_user_id) ON DELETE RESTRICT,
                UNIQUE(id,workspace_id,owner_user_id))""",
            "CREATE INDEX IF NOT EXISTS idx_produce_workspace_owner ON produce(workspace_id,owner_user_id)",
            """CREATE TABLE IF NOT EXISTS produce_scans (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
                produce_id TEXT NOT NULL, farm_id TEXT, created_at TEXT NOT NULL, result_json TEXT NOT NULL,
                image_key TEXT, status TEXT NOT NULL DEFAULT 'completed', vision_result_json TEXT,
                shelf_life_result_json TEXT, decision_json TEXT, shelf_life_inputs_json TEXT,
                prediction_id TEXT, error_code TEXT, updated_at TEXT, market_snapshot_json TEXT,
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE,
                FOREIGN KEY(produce_id,workspace_id,owner_user_id) REFERENCES produce(id,workspace_id,owner_user_id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_scans_workspace_owner ON produce_scans(workspace_id,owner_user_id,created_at)",
            """CREATE TABLE IF NOT EXISTS shelf_life_predictions (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, produce_id TEXT,
                model_name TEXT NOT NULL, model_version TEXT NOT NULL, predicted_days DOUBLE PRECISION NOT NULL,
                created_at TEXT NOT NULL, input_provenance_json TEXT NOT NULL,
                development_only BOOLEAN NOT NULL DEFAULT TRUE, real_world_validated BOOLEAN NOT NULL DEFAULT FALSE,
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE,
                FOREIGN KEY(produce_id,workspace_id,owner_user_id) REFERENCES produce(id,workspace_id,owner_user_id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_predictions_workspace_owner ON shelf_life_predictions(workspace_id,owner_user_id)",
            """CREATE TABLE IF NOT EXISTS agent_runs (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
                created_at TEXT NOT NULL, result_json TEXT NOT NULL,
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_owner ON agent_runs(workspace_id,owner_user_id)",
            """CREATE TABLE IF NOT EXISTS market_snapshots (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
                cache_key TEXT NOT NULL, normalized_json TEXT NOT NULL, source TEXT, fetched_at TEXT NOT NULL,
                expires_at DOUBLE PRECISION NOT NULL,
                FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE)""",
            "CREATE INDEX IF NOT EXISTS idx_market_snapshots_cache ON market_snapshots(workspace_id,owner_user_id,cache_key,expires_at)",
        ]
        with self.connect() as db:
            for statement in statements:
                db.execute(statement)
            for table in ("users", "workspaces", "workspace_members", "sessions", "farms", "produce",
                          "produce_scans", "shelf_life_predictions", "agent_runs", "market_snapshots"):
                db.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
                db.execute(f'REVOKE ALL ON TABLE "{table}" FROM anon, authenticated')

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
        return "scrypt$16384$8$1${}${}".format(salt.hex(), digest.hex())

    @staticmethod
    def _verify_password(password: str, encoded: str) -> bool:
        try:
            algorithm, n, r, p, salt_hex, digest_hex = encoded.split("$")
            if algorithm != "scrypt":
                return False
            candidate = hashlib.scrypt(
                password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
                n=int(n), r=int(r), p=int(p), dklen=len(bytes.fromhex(digest_hex)),
            )
            return hmac.compare_digest(candidate.hex(), digest_hex)
        except (ValueError, TypeError):
            return False

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().casefold()

    @staticmethod
    def normalize_phone(phone: str) -> str:
        value = phone.strip()
        if not value.startswith("+"):
            raise ValueError("Phone number must include a country code, for example +919876543210")
        digits = re.sub(r"\D", "", value)
        if not 8 <= len(digits) <= 15 or digits.startswith("0"):
            raise ValueError("Phone number must be a valid international number")
        return "+" + digits

    def register(self, *, full_name: str, email: str, phone: str, password: str,
                 role: str, workspace_name: str) -> tuple[dict[str, Any], str]:
        if role not in SELF_SERVICE_ROLES:
            raise ValueError("Role must be farmer, vendor, or customer")
        normalized_email = self.normalize_email(email)
        normalized_phone = self.normalize_phone(phone)
        user_id, workspace_id = str(uuid.uuid4()), str(uuid.uuid4())
        timestamp = _now()
        session_token = secrets.token_urlsafe(32)
        token_hash = _token_digest(session_token)
        with self.connect() as db:
            try:
                if self._test_sqlite:
                    db.execute("BEGIN IMMEDIATE")
                db.execute(
                    "INSERT INTO users(id,role,full_name,email,phone,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                    (user_id, role, full_name.strip(), normalized_email, normalized_phone,
                     self._hash_password(password), timestamp, timestamp),
                )
                db.execute("INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)",
                           (workspace_id, workspace_name.strip(), timestamp))
                db.execute("INSERT INTO workspace_members(workspace_id,user_id,role,created_at) VALUES(?,?,?,?)",
                           (workspace_id, user_id, role, timestamp))
                self._insert_session(db, user_id, workspace_id, token_hash, timestamp, None)
                db.commit()
            except (sqlite3.IntegrityError, psycopg.IntegrityError) as exc:
                db.rollback()
                raise ValueError("Unable to register with the supplied details") from exc
        return self.public_user(user_id, workspace_id), session_token

    def _insert_session(self, db: sqlite3.Connection, user_id: str, workspace_id: str,
                        token_hash: str, timestamp: str, user_agent: str | None) -> str:
        session_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO sessions(id,user_id,workspace_id,token_hash,expires_at,created_at,last_used_at,user_agent) VALUES(?,?,?,?,?,?,?,?)",
            (session_id, user_id, workspace_id, token_hash,
             time.time() + SESSION_TTL_HOURS * 3600, timestamp, timestamp,
             user_agent[:300] if user_agent else None),
        )
        return session_id

    def login(self, *, email: str, password: str, user_agent: str | None) -> tuple[dict[str, Any], str]:
        with self.connect() as db:
            row = db.execute("SELECT * FROM users WHERE email=? AND is_active=TRUE",
                             (self.normalize_email(email),)).fetchone()
            if row is None:
                self._verify_password(password, _DUMMY_PASSWORD_HASH)
                raise ValueError("Invalid email or password")
            if not self._verify_password(password, row["password_hash"]):
                raise ValueError("Invalid email or password")
            membership = db.execute(
                "SELECT workspace_id FROM workspace_members WHERE user_id=? ORDER BY created_at LIMIT 1",
                (row["id"],),
            ).fetchone()
            if membership is None:
                raise ValueError("Invalid email or password")
            token = secrets.token_urlsafe(32)
            self._insert_session(db, row["id"], membership["workspace_id"],
                                 _token_digest(token), _now(), user_agent)
            user = self.public_user(row["id"], membership["workspace_id"])
            return user, token

    def public_user(self, user_id: str, workspace_id: str) -> dict[str, Any]:
        with self.connect() as db:
            row = db.execute(
                "SELECT u.id,u.full_name,u.email,u.phone,u.role,u.created_at,w.id AS workspace_id,w.name AS workspace_name "
                "FROM users u JOIN workspace_members m ON m.user_id=u.id "
                "JOIN workspaces w ON w.id=m.workspace_id WHERE u.id=? AND w.id=? AND u.is_active=TRUE",
                (user_id, workspace_id),
            ).fetchone()
            return dict(row) if row else {}

    def authenticate(self, token: str | None) -> dict[str, Any] | None:
        if not token:
            return None
        token_hash = _token_digest(token)
        with self.connect() as db:
            row = db.execute(
                "SELECT s.id AS session_id,s.user_id,s.workspace_id,s.expires_at,u.role,u.email,u.full_name,u.is_active "
                "FROM sessions s JOIN users u ON u.id=s.user_id "
                "WHERE s.token_hash=? AND s.revoked_at IS NULL",
                (token_hash,),
            ).fetchone()
            if row is None or row["expires_at"] <= time.time() or not row["is_active"]:
                return None
            db.execute("UPDATE sessions SET last_used_at=? WHERE id=?", (_now(), row["session_id"]))
            return {key: row[key] for key in (
                "session_id", "user_id", "workspace_id", "role", "email", "full_name"
            )}

    def revoke(self, token: str | None) -> None:
        if not token:
            return
        with self.connect() as db:
            db.execute("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL",
                       (_now(), _token_digest(token)))

    def has_membership(self, user_id: str, workspace_id: str) -> bool:
        with self.connect() as db:
            return db.execute("SELECT 1 FROM workspace_members WHERE user_id=? AND workspace_id=?",
                              (user_id, workspace_id)).fetchone() is not None

    def create_farm(self, user: dict[str, Any], workspace_id: str, name: str, address: str) -> dict[str, Any]:
        farm_id, timestamp = str(uuid.uuid4()), _now()
        with self.connect() as db:
            db.execute(
                "INSERT INTO farms(id,workspace_id,owner_user_id,name,address,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
                (farm_id, workspace_id, user["user_id"], name.strip(), address.strip(), timestamp, timestamp),
            )
        return {"id": farm_id, "workspace_id": workspace_id, "owner_user_id": user["user_id"],
                "name": name.strip(), "address": address.strip(), "created_at": timestamp, "updated_at": timestamp}

    def list_farms(self, user: dict[str, Any], workspace_id: str) -> list[dict[str, Any]]:
        owner_clause = "" if user["role"] == "admin" else " AND owner_user_id=?"
        params: tuple[Any, ...] = (workspace_id,) if user["role"] == "admin" else (workspace_id, user["user_id"])
        with self.connect() as db:
            rows = db.execute("SELECT id,workspace_id,owner_user_id,name,address,created_at,updated_at "
                              "FROM farms WHERE workspace_id=?" + owner_clause + " ORDER BY created_at", params)
            return [dict(row) for row in rows]

    def get_farm(self, farm_id: str, user: dict[str, Any]) -> dict[str, Any] | None:
        owner_clause = "" if user["role"] == "admin" else " AND owner_user_id=?"
        params: tuple[Any, ...] = (farm_id,) if user["role"] == "admin" else (farm_id, user["user_id"])
        with self.connect() as db:
            row = db.execute("SELECT id,workspace_id,owner_user_id,name,address,created_at,updated_at "
                             "FROM farms WHERE id=?" + owner_clause, params).fetchone()
            return dict(row) if row else None

    def update_farm(self, farm_id: str, user: dict[str, Any], name: str, address: str) -> dict[str, Any] | None:
        farm = self.get_farm(farm_id, user)
        if farm is None:
            return None
        with self.connect() as db:
            db.execute("UPDATE farms SET name=?,address=?,updated_at=? WHERE id=?",
                       (name.strip(), address.strip(), _now(), farm_id))
        return self.get_farm(farm_id, user)

    def delete_farm(self, farm_id: str, user: dict[str, Any]) -> bool:
        farm = self.get_farm(farm_id, user)
        if farm is None:
            return False
        with self.connect() as db:
            db.execute("DELETE FROM farms WHERE id=?", (farm_id,))
        return True

    def save_prediction(self, user: dict[str, Any], *, model_name: str, model_version: str,
                        predicted_days: float, provenance: dict[str, str]) -> str:
        prediction_id = str(uuid.uuid4())
        with self.connect() as db:
            db.execute(
                "INSERT INTO shelf_life_predictions(id,workspace_id,owner_user_id,model_name,model_version,"
                "predicted_days,created_at,input_provenance_json,development_only,real_world_validated) "
                "VALUES(?,?,?,?,?,?,?,?,TRUE,FALSE)",
                (prediction_id, user["workspace_id"], user["user_id"], model_name, model_version,
                 predicted_days, _now(), json.dumps(provenance, sort_keys=True)),
            )
        return prediction_id

    def save_agent_run(self, user: dict[str, Any], run_id: str, result: dict[str, Any]) -> None:
        with self.connect() as db:
            db.execute(
                "INSERT INTO agent_runs(id,workspace_id,owner_user_id,created_at,result_json) VALUES(?,?,?,?,?)",
                (run_id, user["workspace_id"], user["user_id"], _now(), json.dumps(result, default=str)),
            )


AUTH_STORE: AuthStore | None = None
router = APIRouter()


class RegisterInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(min_length=9, max_length=20)
    password: str = Field(min_length=12, max_length=256)
    role: str
    workspace_name: str = Field(min_length=2, max_length=120)

    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in SELF_SERVICE_ROLES:
            raise ValueError("Role must be farmer, vendor, or customer")
        return value


class LoginInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class FarmInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(default="", max_length=300)


def get_auth_store() -> AuthStore:
    global AUTH_STORE
    if AUTH_STORE is None:
        AUTH_STORE = AuthStore()
    return AUTH_STORE


def require_authenticated_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    store: AuthStore = Depends(get_auth_store),
) -> dict[str, Any]:
    user = store.authenticate(session_token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def require_role(*roles: str) -> Callable[..., dict[str, Any]]:
    allowed = frozenset(roles)
    def dependency(user: dict[str, Any] = Depends(require_authenticated_user)) -> dict[str, Any]:
        if user["role"] != "admin" and user["role"] not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return dependency


def require_workspace_access(
    workspace_id: str,
    user: dict[str, Any] = Depends(require_authenticated_user),
    store: AuthStore = Depends(get_auth_store),
) -> dict[str, Any]:
    if user["role"] != "admin" and not store.has_membership(user["user_id"], workspace_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace access denied")
    return user


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_TTL_HOURS * 3600, path="/",
        httponly=True, secure=COOKIE_SECURE, samesite="lax",
    )


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    # Explicit allowlist; session/password internals never cross the API boundary.
    keys = ("id", "full_name", "email", "role", "created_at", "workspace_id", "workspace_name")
    return {key: user[key] for key in keys if key in user}


@router.post("/auth/register", status_code=201)
def register(payload: RegisterInput, request: Request, response: Response,
             store: AuthStore = Depends(get_auth_store)):
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", payload.email.strip()):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    try:
        RegisterInput.validate_role(payload.role)
        user, token = store.register(
            full_name=payload.full_name, email=payload.email, phone=payload.phone,
            password=payload.password, role=payload.role, workspace_name=payload.workspace_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _set_session_cookie(response, token)
    return {"user": _public_user(user), "workspace": {"id": user["workspace_id"], "name": user["workspace_name"]}}


@router.post("/auth/login")
def login(payload: LoginInput, request: Request, response: Response,
          store: AuthStore = Depends(get_auth_store)):
    try:
        user, token = store.login(email=payload.email, password=payload.password,
                                  user_agent=request.headers.get("user-agent"))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid email or password") from exc
    _set_session_cookie(response, token)
    return {"user": _public_user(user), "workspace": {"id": user["workspace_id"], "name": user["workspace_name"]}}


@router.post("/auth/logout", status_code=204)
def logout(response: Response,
           session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE),
           store: AuthStore = Depends(get_auth_store)):
    store.revoke(session_token)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, secure=COOKIE_SECURE, samesite="lax")


@router.get("/auth/me")
def auth_me(user: dict[str, Any] = Depends(require_authenticated_user),
            store: AuthStore = Depends(get_auth_store)):
    return {"user": _public_user(store.public_user(user["user_id"], user["workspace_id"]))}


@router.get("/api/workspaces/{workspace_id}/farms")
def list_workspace_farms(workspace_id: str,
                         user: dict[str, Any] = Depends(require_workspace_access),
                         store: AuthStore = Depends(get_auth_store)):
    if user["role"] not in {"farmer", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    return store.list_farms(user, workspace_id)


@router.post("/api/workspaces/{workspace_id}/farms", status_code=201)
def create_workspace_farm(workspace_id: str, payload: FarmInput,
                          user: dict[str, Any] = Depends(require_workspace_access),
                          store: AuthStore = Depends(get_auth_store)):
    if user["role"] not in {"farmer", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    if user["role"] == "admin" and not store.has_membership(user["user_id"], workspace_id):
        raise HTTPException(status_code=403, detail="Admins cannot create records on behalf of workspace members")
    return store.create_farm(user, workspace_id, payload.name, payload.address)


def _owned_farm_or_404(farm_id: str, user: dict[str, Any], store: AuthStore) -> dict[str, Any]:
    farm = store.get_farm(farm_id, user)
    if farm is None:
        raise HTTPException(status_code=404, detail="Farm not found")
    if user["role"] != "admin" and farm["workspace_id"] != user["workspace_id"]:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@router.get("/api/farms/{farm_id}")
def read_farm(farm_id: str, user: dict[str, Any] = Depends(require_role("farmer")),
              store: AuthStore = Depends(get_auth_store)):
    return _owned_farm_or_404(farm_id, user, store)


@router.patch("/api/farms/{farm_id}")
def edit_farm(farm_id: str, payload: FarmInput,
              user: dict[str, Any] = Depends(require_role("farmer")),
              store: AuthStore = Depends(get_auth_store)):
    _owned_farm_or_404(farm_id, user, store)
    return store.update_farm(farm_id, user, payload.name, payload.address)


@router.delete("/api/farms/{farm_id}", status_code=204)
def remove_farm(farm_id: str, user: dict[str, Any] = Depends(require_role("farmer")),
                store: AuthStore = Depends(get_auth_store)):
    _owned_farm_or_404(farm_id, user, store)
    store.delete_farm(farm_id, user)
