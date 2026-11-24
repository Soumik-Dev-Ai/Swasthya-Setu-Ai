"""Auth router."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.db import get_db
from app.models.asha_profile import AshaWorkerProfile
from app.models.user import Role, User
from app.schemas.user import (
    AshaRegistrationRequest,
    AshaRegistrationResponse,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserPublic,
)

router = APIRouter()

# PENDING_ASHA is intentionally excluded — pending users cannot log in.
_KNOWN_ROLES = frozenset({Role.ASHA, Role.ADMIN})


def _stored_role(user: User) -> str:
    """Return the user's stored role, or refuse login if the value is unknown.

    Fail-closed on purpose: an unrecognized role string must NOT be
    silently promoted (or demoted) — it indicates a corrupted/migrated row
    or a tampered record, and the correct answer is to deny access.
    """
    if user.role == Role.PENDING_ASHA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration is pending approval by your local health center. Please wait for activation.",
        )
    if user.role not in _KNOWN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account role is invalid; contact an administrator",
        )
    return user.role


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    role = _stored_role(user)
    return TokenResponse(
        access_token=create_access_token(subject=user.id, role=role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
        username=user.username,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Exchange a valid refresh token for a new access + refresh token pair.

    Rotation: every successful refresh issues a new refresh token, so a
    stolen token has a narrow replay window once the legitimate client
    refreshes (detectable as a 401 on the thief's next call).
    """
    try:
        token_payload = decode_refresh_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    subject = token_payload.get("sub")
    if subject is None:
        raise HTTPException(status_code=401, detail="Token missing subject")
    result = await db.execute(select(User).where(User.id == int(subject)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    role = _stored_role(user)
    return TokenResponse(
        access_token=create_access_token(subject=user.id, role=role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
        username=user.username,
    )


@router.get("/me", response_model=UserPublic)
async def me(current: Annotated[User, Depends(get_current_user)]) -> User:
    return current


@router.post("/register-asha", response_model=AshaRegistrationResponse, status_code=201)
async def register_asha(
    payload: AshaRegistrationRequest,
    db: AsyncSession = Depends(get_db),
) -> AshaRegistrationResponse:
    """Public ASHA worker registration. Creates a PENDING_ASHA user + profile.

    The account is NOT active until an admin approves it via
    /admin/users/{id}/activate. The role is never auto-activated here.
    """
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=Role.PENDING_ASHA,
    )
    db.add(user)
    await db.flush()  # get user.id

    profile = AshaWorkerProfile(
        user_id=user.id,
        full_name=payload.full_name,
        phone=payload.phone,
        village_ward=payload.village_ward,
        block_tehsil=payload.block_tehsil,
        district=payload.district,
        state=payload.state,
        nearest_facility_id=payload.nearest_facility_id,
        specialities=",".join(payload.specialities),
        is_active=False,
    )
    db.add(profile)
    await db.commit()

    return AshaRegistrationResponse(
        status="submitted",
        message=(
            f"Your application has been sent to the local health center in "
            f"{payload.district} for verification. You will be notified once "
            f"your account is activated."
        ),
        username=payload.username,
    )
