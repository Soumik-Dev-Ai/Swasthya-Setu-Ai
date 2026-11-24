"""Security utilities: password hashing and JWT issuing/verification.

Single source of truth for roles: `app.models.user.Role`. This module
re-exports it so existing imports keep working, but it must never define
a second Role of its own (drift risk — see phase 0 reconciliation).
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings
from app.models.user import Role  # single canonical definition; re-exported

__all__ = [
    "Role",
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "decode_refresh_token",
]

# Token-type claim used to keep access and refresh tokens non-interchangeable.
_TOKEN_TYPE_ACCESS = "access"
_TOKEN_TYPE_REFRESH = "refresh"

# Bcrypt's hard input limit — inputs longer than 72 bytes are rejected by
# the backend itself, so pre-hash oversized inputs rather than crashing.
_BCRYPT_MAX_BYTES = 72


def _pw_bytes(password: str) -> bytes:
    raw = password.encode("utf-8")
    if len(raw) <= _BCRYPT_MAX_BYTES:
        return raw
    # Hex digest keeps the pre-hash ASCII and within the byte ceiling.
    import hashlib

    return hashlib.sha256(raw).hexdigest().encode("ascii")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time verification; any malformed input fails closed (False)."""
    try:
        return bcrypt.checkpw(_pw_bytes(plain), hashed.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def _role_value(role: "Role | str") -> str:
    return role.value if isinstance(role, Role) else str(role)


def create_access_token(
    subject: str | int,
    role: "Role | str",
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": _role_value(role),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "typ": _TOKEN_TYPE_ACCESS,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str | int) -> str:
    """Long-lived refresh token: cannot access resources, only mint new access tokens."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "typ": _TOKEN_TYPE_REFRESH,
    }
    return jwt.encode(
        payload, _refresh_secret(), algorithm=settings.JWT_ALGORITHM
    )


def _refresh_secret() -> str:
    """Refresh tokens use a dedicated secret; in dev it may fall back to JWT_SECRET."""
    return settings.JWT_REFRESH_SECRET or settings.JWT_SECRET


def _decode(token: str, *, secret: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    typ = payload.get("typ", _TOKEN_TYPE_ACCESS)
    # Legacy tokens (no `typ` claim) are treated as access tokens; anything
    # presented as a refresh token must carry the correct explicit type.
    if expected_type == _TOKEN_TYPE_REFRESH and typ != expected_type:
        raise ValueError("Invalid token")
    return payload


def decode_token(token: str) -> dict[str, Any]:
    """Decode an access token. Refresh tokens are explicitly rejected here."""
    payload = _decode(token, secret=settings.JWT_SECRET, expected_type=_TOKEN_TYPE_ACCESS)
    if payload.get("typ") == _TOKEN_TYPE_REFRESH:
        raise ValueError("Invalid token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode a refresh token. Access tokens are explicitly rejected here."""
    return _decode(token, secret=_refresh_secret(), expected_type=_TOKEN_TYPE_REFRESH)
