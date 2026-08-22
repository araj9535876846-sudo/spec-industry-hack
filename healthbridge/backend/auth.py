"""
HealthBridge production-style demo authentication.

Uses:
- SQLite for accounts/sessions
- PBKDF2-HMAC-SHA256 password hashing
- Random opaque bearer tokens
- Server-side DOB/age verification
- Token invalidation on logout

Add to existing FastAPI main.py:
    from auth import router as auth_router
    app.include_router(auth_router)

This module uses only Python stdlib + FastAPI/Pydantic.
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "healthbridge.db"

PBKDF2_ITERATIONS = 310_000
SESSION_DAYS = 7
MIN_AGE = 18  # user must be strictly older than 18


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# =========================================================
# DATABASE
# =========================================================

def get_db():
    db = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,
    )
    db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            dob TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )
        """
    )

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            is_revoked INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )

    db.commit()
    db.close()


init_db()


# =========================================================
# HELPERS
# =========================================================

def utc_now():
    return datetime.now(timezone.utc)


def parse_dob(value: str):
    try:
        dob = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail="Date of birth must be YYYY-MM-DD.",
        ) from exc

    if dob > date.today():
        raise HTTPException(
            status_code=400,
            detail="Date of birth cannot be in the future.",
        )

    return dob


def calculate_age(dob: date) -> int:
    today = date.today()

    age = today.year - dob.year

    if (
        (today.month, today.day)
        <
        (dob.month, dob.day)
    ):
        age -= 1

    return age


import re


def normalize_email(email: str) -> str:
    return email.strip().lower()


def valid_email(email: str) -> bool:
    return bool(
        re.match(
            r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
            email,
        )
    )


def hash_password(password: str, salt: bytes | None = None):
    if salt is None:
        salt = os.urandom(16)

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )

    return (
        digest.hex(),
        salt.hex(),
    )


def verify_password(
    password: str,
    stored_hash: str,
    stored_salt: str,
):
    try:
        salt = bytes.fromhex(stored_salt)
    except ValueError:
        return False

    candidate, _ = hash_password(
        password,
        salt,
    )

    return hmac.compare_digest(
        candidate,
        stored_hash,
    )


def make_session_token():
    return secrets.token_urlsafe(48)


def hash_token(token: str):
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def create_session(user_id: int):
    raw_token = make_session_token()
    token_hash = hash_token(raw_token)

    now = utc_now()
    expires = now + timedelta(
        days=SESSION_DAYS
    )

    db = get_db()

    # Remove expired sessions for this account.
    db.execute(
        """
        DELETE FROM sessions
        WHERE user_id = ? AND expires_at < ?
        """,
        (
            user_id,
            now.isoformat(),
        ),
    )

    db.execute(
        """
        INSERT INTO sessions (
            user_id,
            token_hash,
            created_at,
            expires_at,
            is_revoked
        )
        VALUES (?, ?, ?, ?, 0)
        """,
        (
            user_id,
            token_hash,
            now.isoformat(),
            expires.isoformat(),
        ),
    )

    db.commit()
    db.close()

    return raw_token


def get_user_from_token(
    authorization: str | None,
):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authentication required.",
        )

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=401,
            detail="Use Bearer authentication.",
        )

    raw_token = authorization[len(prefix):].strip()

    if not raw_token:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    token_hash = hash_token(
        raw_token
    )

    db = get_db()

    row = db.execute(
        """
        SELECT
            users.id,
            users.email,
            users.dob,
            users.created_at,
            users.is_active,
            sessions.expires_at,
            sessions.is_revoked
        FROM sessions
        INNER JOIN users
            ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
        LIMIT 1
        """,
        (token_hash,),
    ).fetchone()

    db.close()

    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Account is disabled.",
        )

    if row["is_revoked"]:
        raise HTTPException(
            status_code=401,
            detail="Session has been logged out.",
        )

    try:
        expires_at = datetime.fromisoformat(
            row["expires_at"]
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid session.",
        )

    if expires_at <= utc_now():
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please login again.",
        )

    dob = parse_dob(row["dob"])
    age = calculate_age(dob)

    if age <= MIN_AGE:
        raise HTTPException(
            status_code=403,
            detail="Chat access requires the user to be older than 18.",
        )

    return {
        "id": row["id"],
        "email": row["email"],
        "dob": row["dob"],
        "age": age,
    }


# =========================================================
# MODELS
# =========================================================

class SignupRequest(BaseModel):
    email: str
    password: str = Field(
        min_length=8,
        max_length=128,
    )
    dob: str


class LoginRequest(BaseModel):
    email: str
    password: str = Field(
        min_length=1,
        max_length=128,
    )


# =========================================================
# SIGN UP
# =========================================================

@router.post("/signup")
async def signup(request: SignupRequest):
    email = normalize_email(request.email)

    if not valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")

    dob = parse_dob(
        request.dob
    )

    age = calculate_age(dob)

    # Strict requirement: > 18.
    if age <= MIN_AGE:
        raise HTTPException(
            status_code=403,
            detail="HealthBridge chat access requires you to be older than 18.",
        )

    if len(request.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters.",
        )

    password_hash, password_salt = hash_password(
        request.password
    )

    db = get_db()

    try:
        cursor = db.execute(
            """
            INSERT INTO users (
                email,
                password_hash,
                password_salt,
                dob,
                created_at,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (
                email,
                password_hash,
                password_salt,
                dob.isoformat(),
                utc_now().isoformat(),
            ),
        )

        user_id = cursor.lastrowid
        db.commit()

    except sqlite3.IntegrityError:
        db.rollback()
        db.close()

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    db.close()

    token = create_session(
        user_id
    )

    return {
        "success": True,
        "message": "Account created successfully.",
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "age": age,
            "age_verified": True,
        },
    }


# =========================================================
# LOGIN
# =========================================================

@router.post("/login")
async def login(request: LoginRequest):
    email = normalize_email(request.email)

    if not valid_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")

    db = get_db()

    row = db.execute(
        """
        SELECT
            id,
            email,
            password_hash,
            password_salt,
            dob,
            is_active
        FROM users
        WHERE email = ?
        LIMIT 1
        """,
        (email,),
    ).fetchone()

    db.close()

    if row is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not row["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="This account is disabled.",
        )

    if not verify_password(
        request.password,
        row["password_hash"],
        row["password_salt"],
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    dob = parse_dob(row["dob"])
    age = calculate_age(dob)

    if age <= MIN_AGE:
        raise HTTPException(
            status_code=403,
            detail="This account is not eligible for HealthBridge chat access.",
        )

    token = create_session(
        row["id"]
    )

    return {
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "age": age,
            "age_verified": True,
        },
    }


# =========================================================
# CURRENT USER
# =========================================================

@router.get("/me")
async def me(
    authorization: str | None = Header(
        default=None
    ),
):
    user = get_user_from_token(
        authorization
    )

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "age": user["age"],
            "age_verified": True,
        },
    }


# =========================================================
# LOGOUT
# =========================================================

@router.post("/logout")
async def logout(
    authorization: str | None = Header(
        default=None
    ),
):
    if not authorization:
        return {
            "success": True
        }

    prefix = "Bearer "

    if not authorization.startswith(prefix):
        return {
            "success": True
        }

    token = authorization[len(prefix):].strip()

    if not token:
        return {
            "success": True
        }

    token_hash = hash_token(token)

    db = get_db()

    db.execute(
        """
        UPDATE sessions
        SET is_revoked = 1
        WHERE token_hash = ?
        """,
        (token_hash,),
    )

    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Logged out successfully.",
    }