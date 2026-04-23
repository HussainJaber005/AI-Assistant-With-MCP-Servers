import os  # التعامل مع أسماء الملفات
import traceback  # طباعة تفاصيل الخطأ
from pathlib import Path  # إدارة المسارات والملفات

from fastapi import FastAPI, HTTPException, Request, Form  # بناء API واستقبال الطلبات والفورم
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse, RedirectResponse  # أنواع الردود المختلفة
from fastapi.middleware.cors import CORSMiddleware  # السماح بطلبات المتصفح
from fastapi.staticfiles import StaticFiles  # عرض الملفات الثابتة
from pydantic import BaseModel  # تعريف شكل البيانات
from starlette.middleware.sessions import SessionMiddleware  # إدارة جلسات تسجيل الدخول

from main import ai_assistant  # استدعاء منطق الذكاء
from ui import INDEX_HTML  # جلب واجهة الموقع

from database import SessionLocal, init_db  # الاتصال بقاعدة البيانات وتهيئتها
from auth import create_user, authenticate_user, get_user_by_id  # دوال المصادقة
from login_ui import LOGIN_HTML  # صفحة تسجيل الدخول
from register_ui import REGISTER_HTML  # صفحة التسجيل


# =========================
# APP SETUP
# =========================
# إنشاء تطبيق FastAPI
app = FastAPI(
    title="AI Assistant Debug Mode",
    version="0.6",
)

# إضافة middleware للجلسات
app.add_middleware(SessionMiddleware, secret_key="super-secret-key-change-this")

# تحديد مسار المشروع الحالي
BASE_DIR = Path(__file__).resolve().parent

# تحديد مجلد حفظ النتائج
RESULT_DIR = BASE_DIR / "result"

# إنشاء المجلد إذا لم يكن موجودًا
RESULT_DIR.mkdir(exist_ok=True)

# تهيئة قاعدة البيانات وإنشاء الجداول
init_db()


# =========================
# CORS
# =========================
# هذا يسمح للواجهة الأمامية أن ترسل طلبات إلى الباك إند
# الإعداد هنا مفتوح بالكامل لأن المشروع ما زال للتجربة
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# STATIC FILES
# =========================
# هذا يجعل ملفات HTML داخل result
# متاحة عبر الرابط /result/filename.html
app.mount("/result", StaticFiles(directory=str(RESULT_DIR)), name="result")


# =========================
# REQUEST MODELS
# =========================
# هذا يحدد شكل البيانات القادمة من الفرونت إند
class PostApiBody(BaseModel):
    user_query: str


# =========================
# HELPER FUNCTIONS
# =========================
# جلب المستخدم الحالي من الـ session
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None

    db = SessionLocal()
    try:
        user = get_user_by_id(db, user_id)
        return user
    finally:
        db.close()


# =========================
# ROUTES
# =========================

# الصفحة الرئيسية
# إذا المستخدم غير مسجل دخول، يتم تحويله إلى login
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    user = get_current_user(request)
    if not user:
        return RedirectResponse(url="/login", status_code=303)

    return HTMLResponse(content=INDEX_HTML)


# =========================
# AUTH ROUTES
# =========================

# عرض صفحة تسجيل الدخول
@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    user = get_current_user(request)
    if user:
        return RedirectResponse(url="/", status_code=303)

    html = LOGIN_HTML.replace("{{error_block}}", "")
    return HTMLResponse(content=html)


# تنفيذ تسجيل الدخول
@app.post("/login", response_class=HTMLResponse)
async def login_action(
    request: Request,
    email: str = Form(...),
    password: str = Form(...)
):
    db = SessionLocal()
    try:
        user = authenticate_user(db, email, password)

        if not user:
            html = LOGIN_HTML.replace(
                "{{error_block}}",
                '<div class="msg">Invalid email or password</div>'
            )
            return HTMLResponse(content=html)

        request.session["user_id"] = user.id
        request.session["username"] = user.username

        return RedirectResponse(url="/", status_code=303)
    finally:
        db.close()


# عرض صفحة التسجيل
@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    user = get_current_user(request)
    if user:
        return RedirectResponse(url="/", status_code=303)

    html = REGISTER_HTML.replace("{{error_block}}", "")
    return HTMLResponse(content=html)


# تنفيذ التسجيل
@app.post("/register", response_class=HTMLResponse)
async def register_action(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    db = SessionLocal()
    try:
        user, error = create_user(db, username, email, password)

        if error:
            html = REGISTER_HTML.replace(
                "{{error_block}}",
                f'<div class="msg">{error}</div>'
            )
            return HTMLResponse(content=html)

        request.session["user_id"] = user.id
        request.session["username"] = user.username

        return RedirectResponse(url="/", status_code=303)
    finally:
        db.close()


# تسجيل الخروج
@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


# =========================
# RESULTS ROUTES
# =========================

# جلب قائمة الملفات الناتجة
# يعيد كل ملفات HTML الموجودة داخل result
@app.get("/results")
async def list_results(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

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


# جلب السورس الخاص بملف معين
# يعيد محتوى HTML كنص عادي
@app.get("/source/{file_name}")
async def get_source(file_name: str, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    file_path = RESULT_DIR / file_name

    # إذا الملف غير موجود نرجع 404
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # قراءة الملف كنص مع utf-8 لتجنب مشاكل الترميز
    return PlainTextResponse(
        file_path.read_text(encoding="utf-8"),
        media_type="text/plain"
    )


# =========================
# DEBUG MIDDLEWARE
# =========================
# هذا middleware يطبع كل request و response
# حتى يسهل تتبع الأخطاء أثناء التطوير
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
# هذا هو endpoint الأساسي
# يستقبل وصف المستخدم ويرسل الطلب إلى main.py
@app.post("/ai_assistant")
async def calling_ai(body: PostApiBody, request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    print("\n=== NEW REQUEST ===")
    print("User query:", body.user_query)

    try:
        # تشغيل منطق الذكاء الاصطناعي
        response = await ai_assistant(body.user_query)

        # استخراج اسم الملف فقط من المسار الكامل
        file_name = os.path.basename(response["file_path"])

        print("[SUCCESS] Generated:", file_name)

        # إرجاع البيانات للواجهة الأمامية
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
        # استخراج نص الخطأ والـ traceback الكامل
        error_text = str(e)
        trace = traceback.format_exc()

        print("\n=== ERROR OCCURRED ===")
        print("Error:", error_text)
        print("Traceback:\n", trace)

        # تصنيف نوع الخطأ بشكل تقريبي
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

        # إرجاع الخطأ بشكل JSON واضح
        return JSONResponse(
            status_code=status,
            content={
                "detail": msg,
                "error": error_text,
                "trace": trace
            }
        )