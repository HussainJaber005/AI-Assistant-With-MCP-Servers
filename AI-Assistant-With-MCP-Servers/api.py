import os
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware

from main import ai_assistant, clarify_brief
from database import SessionLocal, init_db
from auth import create_user, authenticate_user, get_user_by_id


# =========================
# APP SETUP
# =========================
app = FastAPI(
    title="AI Assistant API",
    version="1.0",
)

app.add_middleware(SessionMiddleware, secret_key="super-secret-key-change-this")

BASE_DIR = Path(__file__).resolve().parent
RESULT_DIR = BASE_DIR / "result"
RESULT_DIR.mkdir(exist_ok=True)

init_db()


# =========================
# CORS
# =========================
# Dev: React on :5173 calls API on :8000 with credentials.
# Must list explicit origin (not "*") when credentials are allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# STATIC FILES
# =========================
app.mount("/result", StaticFiles(directory=str(RESULT_DIR)), name="result")


# =========================
# REQUEST / RESPONSE MODELS
# =========================
class RegisterBody(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class AiBody(BaseModel):
    user_query: str


class ClarifyBody(BaseModel):
    user_query: str


def _user_dto(user):
    return {"id": user.id, "username": user.username, "email": user.email}


# =========================
# AUTH HELPERS
# =========================
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None

    db = SessionLocal()
    try:
        return get_user_by_id(db, user_id)
    finally:
        db.close()


def require_user(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


# =========================
# AUTH ROUTES (JSON)
# =========================
@app.post("/api/auth/register")
async def register(body: RegisterBody, request: Request):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = SessionLocal()
    try:
        user, error = create_user(db, body.username, body.email, body.password)
        if error:
            raise HTTPException(status_code=409, detail=error)

        request.session["user_id"] = user.id
        request.session["username"] = user.username
        return {"user": _user_dto(user)}
    finally:
        db.close()


@app.post("/api/auth/login")
async def login(body: LoginBody, request: Request):
    db = SessionLocal()
    try:
        user = authenticate_user(db, body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        request.session["user_id"] = user.id
        request.session["username"] = user.username
        return {"user": _user_dto(user)}
    finally:
        db.close()


@app.post("/api/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/auth/me")
async def me(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"user": _user_dto(user)}


# =========================
# RESULTS ROUTES
# =========================
@app.get("/api/results")
async def list_results(request: Request):
    require_user(request)

    files = sorted(
        [f for f in RESULT_DIR.iterdir() if f.suffix == ".html"],
        key=lambda x: x.stat().st_mtime,
        reverse=True,
    )
    return {
        "results": [
            {
                "file_name": f.name,
                "file_url": f"/result/{f.name}",
                "source_url": f"/api/source/{f.name}",
                "mtime": f.stat().st_mtime,
                "size": f.stat().st_size,
            }
            for f in files
        ]
    }


@app.delete("/api/results/{file_name}")
async def delete_result(file_name: str, request: Request):
    require_user(request)
    # Guard against path traversal
    if "/" in file_name or ".." in file_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    file_path = RESULT_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    file_path.unlink()
    return {"ok": True}


@app.get("/api/source/{file_name}")
async def get_source(file_name: str, request: Request):
    require_user(request)

    file_path = RESULT_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return PlainTextResponse(
        file_path.read_text(encoding="utf-8"),
        media_type="text/plain",
    )


# =========================
# AI ENDPOINTS
# =========================
@app.post("/api/ai_clarify")
async def ai_clarify(body: ClarifyBody, request: Request):
    """Analyze a brief and return 3–5 design clarifying questions."""
    require_user(request)
    try:
        questions, logs = await clarify_brief(body.user_query)
        return {
            "questions": questions,
            "debug_message": "\n".join(logs),
        }
    except Exception as e:
        error_text = str(e)
        lower = error_text.lower()
        if "429" in lower or "rate" in lower:
            status, msg = 429, "Rate limited by provider"
        elif "timeout" in lower:
            status, msg = 504, "Model timeout"
        else:
            status, msg = 500, "Clarify failed"
        return JSONResponse(
            status_code=status,
            content={"detail": msg, "error": error_text},
        )


@app.post("/api/ai_assistant")
async def calling_ai(body: AiBody, request: Request):
    require_user(request)

    try:
        response = await ai_assistant(body.user_query)
        file_name = os.path.basename(response["file_path"])

        return {
            "response": {
                "message": "Generated successfully",
                "file_name": file_name,
                "file_url": f"/result/{file_name}",
                "source_url": f"/api/source/{file_name}",
                "debug_message": response.get("debug_message", ""),
            }
        }

    except Exception as e:
        error_text = str(e)
        trace = traceback.format_exc()
        lower = error_text.lower()

        if "429" in lower or "rate" in lower:
            status, msg = 429, "Rate limited by provider"
        elif "402" in lower or "credit" in lower:
            status, msg = 402, "Credits exhausted"
        elif "api key" in lower or "unauthorized" in lower:
            status, msg = 401, "Invalid API key"
        elif "timeout" in lower:
            status, msg = 504, "Model timeout"
        else:
            status, msg = 500, "Internal server error"

        return JSONResponse(
            status_code=status,
            content={"detail": msg, "error": error_text, "trace": trace},
        )


# =========================
# DEBUG MIDDLEWARE
# =========================
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"\n[REQUEST] {request.method} {request.url}")
    try:
        response = await call_next(request)
        print(f"[RESPONSE] Status: {response.status_code}")
        return response
    except Exception as e:
        print("[MIDDLEWARE ERROR]", str(e))
        raise e
