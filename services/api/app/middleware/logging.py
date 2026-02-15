"""
services/api/app/middleware/logging.py
Request/response logging middleware
"""

import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Start timer
        start_time = time.time()

        # Get request info
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Call next middleware/route
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Log the request
        logger.info(
            f"{method} {path} - {response.status_code} - "
            f"{duration:.3f}s - {client_ip}"
        )

        # Add response header with duration
        response.headers["X-Process-Time"] = str(duration)

        return response
