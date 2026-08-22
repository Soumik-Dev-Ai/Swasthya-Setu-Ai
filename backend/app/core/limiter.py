"""Shared slowapi Limiter instance.

Lives in its own module so routers can import it without triggering a
circular import through `app.main`.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-IP rate limiter. Default limits come from route decorators; this
# base instance is required by slowapi's state model.
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
