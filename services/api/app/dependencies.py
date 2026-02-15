"""
services/api/app/dependencies.py
Common dependencies for routes
"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db, User
from app.auth import verify_access_token
from app.exceptions import UnauthorizedException


async def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token"""
    if not authorization:
        raise UnauthorizedException("Missing authorization header")

    # Extract token from "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise UnauthorizedException("Invalid authorization scheme")
    except ValueError:
        raise UnauthorizedException("Invalid authorization header")

    # Verify token and get user_id
    payload = verify_access_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise UnauthorizedException("Invalid token")

    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise UnauthorizedException("User not found")

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user
