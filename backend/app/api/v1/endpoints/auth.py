import logging
from fastapi import APIRouter, Depends, status
from ....core.security import get_current_user, AuthenticatedUser
from ....schemas.auth import (
    UserProfileResponse,
    UserProfileData,
    UpdateProfileRequest,
    SyncProfileRequest,
    OnboardingRequest,
)
from ....repositories.user_repository import user_repository
from ....core.exceptions import AgriTraceAPIException

logger = logging.getLogger("agritrace.auth")

router = APIRouter()

ALLOWED_PUBLIC_ROLES = {"FARMER", "VENDOR", "CUSTOMER"}
ALLOWED_SYSTEM_ROLES = {"FARMER", "VENDOR", "CUSTOMER", "ADMIN"}

@router.get("/me", response_model=UserProfileResponse, tags=["Authentication & Profiles"])
async def get_my_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns the authoritative verified profile of the authenticated user.
    If the user has not completed onboarding, returns onboarding_completed=False without
    locking them into a default CUSTOMER role in durable storage.
    """
    stored = await user_repository.get_by_uid(current_user.uid)
    if not stored:
        # Check if the user has a verified non-default role from token claims or test mock
        if current_user.role in ALLOWED_SYSTEM_ROLES and current_user.role != "CUSTOMER":
            profile_dict = {
                "email": current_user.email,
                "full_name": current_user.full_name or "AgriTrace User",
                "role": current_user.role,
                "phone": None,
                "address": None,
                "language_preference": "en",
                "onboarding_completed": True,
            }
            try:
                stored = await user_repository.save_profile(current_user.uid, profile_dict)
            except Exception as e:
                logger.warning("Atlas unavailable; returning ephemeral session profile for %s: %s", current_user.uid, e)
                stored = profile_dict
            return UserProfileResponse(
                success=True,
                data=UserProfileData(
                    id=current_user.uid,
                    email=current_user.email,
                    full_name=stored.get("full_name"),
                    role=stored.get("role"),
                    phone=stored.get("phone"),
                    address=stored.get("address"),
                    language_preference=stored.get("language_preference", "en"),
                    onboarding_completed=True,
                ),
            )

        # User is authenticated in Firebase but has not completed AgriTrace role onboarding
        return UserProfileResponse(
            success=True,
            data=UserProfileData(
                id=current_user.uid,
                email=current_user.email,
                full_name=current_user.full_name or "AgriTrace User",
                role="CUSTOMER",
                phone=None,
                address=None,
                language_preference="en",
                onboarding_completed=False,
            ),
        )

    return UserProfileResponse(
        success=True,
        data=UserProfileData(
            id=current_user.uid,
            email=current_user.email,
            full_name=stored.get("full_name") or current_user.full_name or "AgriTrace User",
            role=stored.get("role") or current_user.role,
            phone=stored.get("phone"),
            address=stored.get("address"),
            language_preference=stored.get("language_preference", "en"),
            onboarding_completed=stored.get("onboarding_completed", True),
        ),
    )

@router.post("/onboarding", response_model=UserProfileResponse, tags=["Authentication & Profiles"])
async def complete_onboarding(
    payload: OnboardingRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Dedicated authenticated onboarding endpoint for new users (including Google Sign-In).
    Validates selected role against public allowlist (FARMER, VENDOR, CUSTOMER).
    Associates profile exclusively with current_user.uid from verified token.
    Idempotent: if called repeatedly with the same role, preserves role and returns profile.
    Rejects unauthorized role escalation (e.g. ADMIN).
    """
    norm_role = payload.role.strip().upper() if payload.role else ""
    if norm_role not in ALLOWED_PUBLIC_ROLES:
        raise AgriTraceAPIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ROLE",
            message=f"Invalid role selection '{payload.role}'. Must be one of: {', '.join(sorted(ALLOWED_PUBLIC_ROLES))}",
        )

    stored = await user_repository.get_by_uid(current_user.uid)
    if stored and stored.get("onboarding_completed") is True:
        existing_role = stored.get("role")
        # Idempotent if same role
        if existing_role == norm_role:
            return UserProfileResponse(
                success=True,
                data=UserProfileData(
                    id=current_user.uid,
                    email=current_user.email,
                    full_name=stored.get("full_name") or current_user.full_name or "AgriTrace User",
                    role=existing_role,
                    phone=stored.get("phone"),
                    address=stored.get("address"),
                    language_preference=stored.get("language_preference", "en"),
                    onboarding_completed=True,
                ),
            )
        else:
            # Existing role conflict: preserve stored role, do not overwrite silently
            logger.warning(
                "User %s attempted to re-onboard with role %s but already has completed role %s",
                current_user.uid, norm_role, existing_role
            )
            raise AgriTraceAPIException(
                status_code=status.HTTP_409_CONFLICT,
                code="ROLE_ALREADY_ASSIGNED",
                message=f"Account already has completed role '{existing_role}'. Cannot overwrite via onboarding.",
            )

    # Save new completed profile
    saved = await user_repository.save_profile(current_user.uid, {
        "email": current_user.email,
        "full_name": payload.fullName or current_user.full_name or "AgriTrace User",
        "role": norm_role,
        "phone": payload.phone,
        "address": payload.address,
        "language_preference": payload.languagePreference or "en",
        "onboarding_completed": True,
    })

    return UserProfileResponse(
        success=True,
        data=UserProfileData(
            id=current_user.uid,
            email=current_user.email,
            full_name=saved.get("full_name") or "AgriTrace User",
            role=saved.get("role") or norm_role,
            phone=saved.get("phone"),
            address=saved.get("address"),
            language_preference=saved.get("language_preference", "en"),
            onboarding_completed=True,
        ),
    )

@router.patch("/profile", response_model=UserProfileResponse, tags=["Authentication & Profiles"])
async def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Updates the authenticated user's profile metadata.
    Associates update exclusively with current_user.uid; ignores any spoofed ID in payload.
    """
    updates = {}
    if payload.fullName is not None:
        updates["full_name"] = payload.fullName
    if payload.phone is not None:
        updates["phone"] = payload.phone
    if payload.address is not None:
        updates["address"] = payload.address
    if payload.languagePreference is not None:
        updates["language_preference"] = payload.languagePreference
    if payload.role is not None:
        norm_role = payload.role.strip().upper()
        if norm_role not in ALLOWED_PUBLIC_ROLES:
            raise AgriTraceAPIException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="INVALID_ROLE",
                message=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(ALLOWED_PUBLIC_ROLES))}",
            )
        updates["role"] = norm_role

    saved = await user_repository.save_profile(current_user.uid, updates)

    return UserProfileResponse(
        success=True,
        data=UserProfileData(
            id=current_user.uid,
            email=current_user.email,
            full_name=saved.get("full_name") or "AgriTrace User",
            role=saved.get("role") or current_user.role,
            phone=saved.get("phone"),
            address=saved.get("address"),
            language_preference=saved.get("language_preference", "en"),
            onboarding_completed=saved.get("onboarding_completed", True),
        ),
    )

@router.post("/sync-profile", response_model=UserProfileResponse, tags=["Authentication & Profiles"])
async def sync_my_profile(
    payload: SyncProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Synchronizes initial registration profile metadata (used during email/password signup).
    Validates role against ALLOWED_PUBLIC_ROLES and rejects ADMIN escalation.
    """
    norm_role = payload.role.strip().upper() if payload.role else "CUSTOMER"
    if norm_role not in ALLOWED_PUBLIC_ROLES:
        raise AgriTraceAPIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ROLE",
            message=f"Invalid role selection '{payload.role}'. Must be one of: {', '.join(sorted(ALLOWED_PUBLIC_ROLES))}",
        )

    stored = await user_repository.get_by_uid(current_user.uid)

    updates = {
        "email": current_user.email,
        "role": norm_role,
        "onboarding_completed": True,
    }
    full_name = payload.fullName or (stored.get("full_name") if stored else None) or current_user.full_name or "AgriTrace User"
    updates["full_name"] = full_name
    if payload.phone is not None:
        updates["phone"] = payload.phone
    elif stored and stored.get("phone"):
        updates["phone"] = stored.get("phone")
    if payload.address is not None:
        updates["address"] = payload.address
    elif stored and stored.get("address"):
        updates["address"] = stored.get("address")
    if payload.languagePreference:
        updates["language_preference"] = payload.languagePreference
    elif stored and stored.get("language_preference"):
        updates["language_preference"] = stored.get("language_preference")

    saved = await user_repository.save_profile(current_user.uid, updates)

    return UserProfileResponse(
        success=True,
        data=UserProfileData(
            id=current_user.uid,
            email=current_user.email,
            full_name=saved.get("full_name"),
            role=saved.get("role", norm_role),
            phone=saved.get("phone"),
            address=saved.get("address"),
            language_preference=saved.get("language_preference", "en"),
            onboarding_completed=True,
        ),
    )
