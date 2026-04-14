import os
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from main import ai_assistant
from ui import INDEX_HTML

app = FastAPI(
    title="AI Assistant Debug Mode",
    version="0.6",
)

BASE_DIR = Path(__file__).resolve().parent
RESULT_DIR = BASE_DIR / "result"
RESULT_DIR.mkdir(exist_ok=True)

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Static
# =========================
app.mount("/result", StaticFiles(directory=str(RESULT_DIR)), name="result")


# =========================
# Models
# =========================
class PostApiBody(BaseModel):
    user_query: str


# =========================
# Routes
# =========================

@app.get("/", response_class=HTMLResponse)
async def home():
    return HTMLResponse(content=INDEX_HTML)


@app.get("/results")
async def list_results():
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
                "source_url": f"/source/{f.name}",
            }
            for f in files
        ]
    }


@app.get("/source/{file_name}")
async def get_source(file_name: str):
    file_path = RESULT_DIR / file_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return PlainTextResponse(file_path.read_text(), media_type="text/plain")


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


# =========================
# MAIN ENDPOINT
# =========================

@app.post("/ai_assistant")
async def calling_ai(body: PostApiBody):
    print("\n=== NEW REQUEST ===")
    print("User query:", body.user_query)

    try:
        response = await ai_assistant(body.user_query)

        file_name = os.path.basename(response["file_path"])

        print("[SUCCESS] Generated:", file_name)

        return JSONResponse(
            status_code=200,
            content={
                "response": {
                    "message": "Generated successfully",
                    "file_name": file_name,
                    "file_url": f"/result/{file_name}",
                    "source_url": f"/source/{file_name}",
                    "debug_message": response.get("debug_message", "")
                }
            }
        )

    except Exception as e:
        error_text = str(e)
        trace = traceback.format_exc()

        print("\n=== ERROR OCCURRED ===")
        print("Error:", error_text)
        print("Traceback:\n", trace)

        # Classification
        lower = error_text.lower()

        if "429" in lower or "rate" in lower:
            status = 429
            msg = "Rate limited by provider"
        elif "402" in lower or "credit" in lower:
            status = 402
            msg = "Credits exhausted"
        elif "api key" in lower or "unauthorized" in lower:
            status = 401
            msg = "Invalid API key"
        elif "timeout" in lower:
            status = 504
            msg = "Model timeout"
        else:
            status = 500
            msg = "Internal server error"

        return JSONResponse(
            status_code=status,
            content={
                "detail": msg,
                "error": error_text,
                "trace": trace
            }
        )