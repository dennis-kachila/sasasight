"""
services/api/app/middleware/__init__.py
Middleware module initialization
"""

from app.middleware.logging import LoggingMiddleware

__all__ = ["LoggingMiddleware"]
