import logging
from typing import Optional, List, Dict, Any
from fastapi import Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from .exceptions import AgriTraceAPIException
from .firebase import verify_firebase_id_token

logger = logging.getLogger("agritrace.security")

bearer_scheme = HTTPBearer(auto_error=False)

class AuthenticatedUser(BaseModel):
    uid: str
    email: Optional[str] = None
    role: str = "CUSTOMER"
    full_name: Optional[str] = None
    token_claims: Dict[str, Any] = {}

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> AuthenticatedUser:
    """
    FastAPI dependency that extracts and cryptographically verifies the Firebase ID token.
    Derives identity exclusively from server-verified token claims.
    """
    if credentials is None:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise AgriTraceAPIException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                code="UNAUTHORIZED",
                message="Missing or malformed Authorization header. Expected: Bearer <token>",
            )
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AgriTraceAPIException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                code="UNAUTHORIZED",
                message="Malformed Authorization header. Format must be: Bearer <token>",
            )
        token = parts[1]
    else:
        token = credentials.credentials

    # Cryptographically verify the token
    decoded = verify_firebase_id_token(token)
    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise AgriTraceAPIException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="INVALID_TOKEN",
            message="Token does not contain a valid subject/UID",
        )

    # Resolve server-side role: check Firebase Custom Claims first, then MongoDB user repository
    stored_profile = None
    try:
        from ..repositories.user_repository import user_repository
        stored_profile = await user_repository.get_by_uid(uid)
    except Exception as exc:
        logger.warning("Could not retrieve user profile for uid %s during auth: %s", uid, exc)

    role = decoded.get("role")
    if not role and stored_profile:
        role = stored_profile.get("role")
    if not role:
        # Default least-privileged role
        role = "CUSTOMER"

    full_name = decoded.get("name") or (stored_profile.get("full_name") if stored_profile else None) or decoded.get("email", "").split("@")[0]

    return AuthenticatedUser(
        uid=uid,
        email=decoded.get("email"),
        role=role.upper(),
        full_name=full_name,
        token_claims=decoded,
    )

def require_role(allowed_roles: List[str]):
    """
    Enforces server-side role authorization.
    Rejects unauthorized access with HTTP 403 Forbidden.
    """
    normalized_allowed = [r.upper() for r in allowed_roles]

    async def role_checker(current_user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if current_user.role not in normalized_allowed:
            raise AgriTraceAPIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN",
                message=f"Access denied: Role '{current_user.role}' is not authorized. Required: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker

async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[AuthenticatedUser]:
    """
    Optional authentication dependency. Returns AuthenticatedUser if valid token provided, else None.
    """
    try:
        return await get_current_user(request, credentials)
    except Exception:
        return None
