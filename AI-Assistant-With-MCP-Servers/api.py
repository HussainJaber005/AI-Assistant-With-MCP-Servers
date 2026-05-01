# =====================================================================
# api.py
# هذا هو الملف الرئيسي لخادم الـ API (الواجهة البرمجية)
# يحتوي على كل المسارات (endpoints) التي يتصل بها الـ frontend
# مهامه:
#   1. إعداد تطبيق FastAPI
#   2. إعداد CORS (للسماح للـ frontend بالاتصال)
#   3. مسارات تسجيل الدخول/التسجيل/الخروج
#   4. مسارات إدارة النتائج (HTML files المُولّدة)
#   5. مسارات الذكاء الاصطناعي (clarify + ai_assistant)
# =====================================================================

# مكتبات Python الأساسية
import os
import traceback
from pathlib import Path

# مكتبات FastAPI لبناء واجهة برمجية سريعة
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
# Pydantic — للتحقق التلقائي من شكل البيانات الواردة من المستخدم
from pydantic import BaseModel, EmailStr
# SessionMiddleware — لإدارة جلسات المستخدمين عبر الكوكيز
from starlette.middleware.sessions import SessionMiddleware

# استيراد الدوال من ملفاتنا الأخرى
from main import ai_assistant, clarify_brief        # دوال الذكاء الاصطناعي
from database import SessionLocal, init_db          # قاعدة البيانات
from auth import create_user, authenticate_user, get_user_by_id  # المصادقة


# =====================================================================
# إعداد التطبيق
# =====================================================================
# إنشاء كائن التطبيق الرئيسي
app = FastAPI(
    title="AI Assistant API",
    version="1.0",
)

# إضافة وسيط الجلسات — يحفظ بيانات المستخدم في كوكي مشفّر
# ملاحظة: يجب تغيير المفتاح السري قبل النشر للإنتاج
app.add_middleware(SessionMiddleware, secret_key="super-secret-key-change-this")

# تحديد المجلدات المهمة
BASE_DIR = Path(__file__).resolve().parent       # مجلد المشروع الحالي
RESULT_DIR = BASE_DIR / "result"                  # مجلد حفظ النتائج HTML
RESULT_DIR.mkdir(exist_ok=True)                   # إنشاؤه إن لم يكن موجودًا

# تهيئة قاعدة البيانات عند بدء التشغيل (إنشاء الجداول لو غير موجودة)
init_db()


# =====================================================================
# إعداد CORS
# =====================================================================
# CORS يسمح للموقع (frontend) الذي يعمل على بورت 5173
# بالاتصال بهذا الخادم الذي يعمل على بورت 8000
# عند استخدام الكوكيز/الجلسات يجب تحديد العنوان بدقة (وليس "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,   # السماح بإرسال الكوكيز مع الطلبات
    allow_methods=["*"],      # كل الأنواع: GET, POST, DELETE, إلخ
    allow_headers=["*"],
)


# =====================================================================
# الملفات الثابتة (Static Files)
# =====================================================================
# جعل مجلد result متاحًا عبر الإنترنت تحت المسار /result
# مثلاً: result/result_1.html تصير على http://localhost:8000/result/result_1.html
app.mount("/result", StaticFiles(directory=str(RESULT_DIR)), name="result")


# =====================================================================
# نماذج البيانات (Request/Response Models)
# Pydantic يتحقق تلقائيًا من شكل البيانات الواردة من المستخدم
# =====================================================================

# شكل بيانات التسجيل: اسم مستخدم + بريد + كلمة مرور
class RegisterBody(BaseModel):
    username: str
    email: EmailStr   # EmailStr يتأكد أن النص بصيغة بريد صحيحة
    password: str


# شكل بيانات تسجيل الدخول: بريد + كلمة مرور
class LoginBody(BaseModel):
    email: EmailStr
    password: str


# شكل طلب الذكاء الاصطناعي: نص الطلب من المستخدم
class AiBody(BaseModel):
    user_query: str


# شكل طلب التوضيح (clarify): نفس الفكرة
class ClarifyBody(BaseModel):
    user_query: str


# دالة مساعدة لتحويل كائن المستخدم لقاموس JSON
# (لا نُرسل كلمة المرور المُشفّرة للـ frontend أبدًا)
def _user_dto(user):
    return {"id": user.id, "username": user.username, "email": user.email}


# =====================================================================
# دوال مساعدة للمصادقة
# =====================================================================

# جلب المستخدم الحالي من الجلسة (cookie)
# يرجع None إذا لم يكن مسجلاً دخوله
def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None

    db = SessionLocal()
    try:
        return get_user_by_id(db, user_id)
    finally:
        # دائمًا نُغلق جلسة قاعدة البيانات بعد الانتهاء
        db.close()


# نفس الدالة السابقة لكنها ترمي خطأ 401 إذا لم يكن المستخدم مسجلاً
# تُستخدم في المسارات المحمية التي تتطلب تسجيل دخول
def require_user(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


# =====================================================================
# مسارات المصادقة (Auth Routes)
# =====================================================================

# مسار التسجيل (إنشاء حساب جديد)
@app.post("/api/auth/register")
async def register(body: RegisterBody, request: Request):
    # تحقق بسيط: كلمة المرور لا تقل عن 6 خانات
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = SessionLocal()
    try:
        # محاولة إنشاء المستخدم — قد ترجع خطأ إن كان البريد/الاسم محجوزًا
        user, error = create_user(db, body.username, body.email, body.password)
        if error:
            raise HTTPException(status_code=409, detail=error)

        # حفظ بيانات الجلسة (المستخدم صار مسجل دخول تلقائيًا)
        request.session["user_id"] = user.id
        request.session["username"] = user.username
        return {"user": _user_dto(user)}
    finally:
        db.close()


# مسار تسجيل الدخول
@app.post("/api/auth/login")
async def login(body: LoginBody, request: Request):
    db = SessionLocal()
    try:
        # التحقق من البريد + كلمة المرور
        user = authenticate_user(db, body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # تخزين بيانات المستخدم في الجلسة
        request.session["user_id"] = user.id
        request.session["username"] = user.username
        return {"user": _user_dto(user)}
    finally:
        db.close()


# مسار تسجيل الخروج — يمسح الجلسة فقط
@app.post("/api/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


# مسار جلب بيانات المستخدم الحالي (للتحقق هل هو مسجل دخول؟)
@app.get("/api/auth/me")
async def me(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"user": _user_dto(user)}


# =====================================================================
# مسارات النتائج (Results Routes)
# =====================================================================

# جلب قائمة كل ملفات HTML المولّدة، مرتبة من الأحدث للأقدم
@app.get("/api/results")
async def list_results(request: Request):
    require_user(request)   # محمي — يجب تسجيل الدخول

    # نأخذ كل الملفات بامتداد .html ونرتبها بحسب وقت التعديل
    files = sorted(
        [f for f in RESULT_DIR.iterdir() if f.suffix == ".html"],
        key=lambda x: x.stat().st_mtime,
        reverse=True,   # الأحدث أولًا
    )
    # نُرجع لكل ملف معلوماته الأساسية
    return {
        "results": [
            {
                "file_name": f.name,
                "file_url": f"/result/{f.name}",          # رابط العرض
                "source_url": f"/api/source/{f.name}",    # رابط الكود الخام
                "mtime": f.stat().st_mtime,                # وقت التعديل
                "size": f.stat().st_size,                  # حجم الملف
            }
            for f in files
        ]
    }


# حذف ملف نتيجة معين
@app.delete("/api/results/{file_name}")
async def delete_result(file_name: str, request: Request):
    require_user(request)
    # حماية ضد هجمات path traversal (محاولة الوصول لملفات خارج المجلد)
    if "/" in file_name or ".." in file_name:
        raise HTTPException(status_code=400, detail="Invalid filename")
    file_path = RESULT_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    # حذف الملف من القرص
    file_path.unlink()
    return {"ok": True}


# جلب الكود الخام (HTML source) لملف معين
@app.get("/api/source/{file_name}")
async def get_source(file_name: str, request: Request):
    require_user(request)

    file_path = RESULT_DIR / file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # نُرجع المحتوى كنص عادي (text/plain) لعرضه في محرر داخل الـ frontend
    return PlainTextResponse(
        file_path.read_text(encoding="utf-8"),
        media_type="text/plain",
    )


# =====================================================================
# مسارات الذكاء الاصطناعي
# =====================================================================

# مسار التوضيح: يأخذ طلب المستخدم ويولّد 3–5 أسئلة توضيحية
# الهدف: فهم متطلبات المستخدم بدقة قبل البناء
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
        # معالجة الأخطاء الشائعة وإرجاع رمز الحالة المناسب
        error_text = str(e)
        lower = error_text.lower()
        if "429" in lower or "rate" in lower:
            status, msg = 429, "Rate limited by provider"   # تجاوز الحد المسموح
        elif "timeout" in lower:
            status, msg = 504, "Model timeout"               # النموذج تأخر
        else:
            status, msg = 500, "Clarify failed"              # خطأ غير متوقع
        return JSONResponse(
            status_code=status,
            content={"detail": msg, "error": error_text},
        )


# مسار المساعد الرئيسي: يأخذ طلب المستخدم ويُولّد ملف HTML
@app.post("/api/ai_assistant")
async def calling_ai(body: AiBody, request: Request):
    require_user(request)

    try:
        # استدعاء دالة الذكاء الاصطناعي الرئيسية
        response = await ai_assistant(body.user_query)
        # استخراج اسم الملف فقط من المسار الكامل
        file_name = os.path.basename(response["file_path"])

        # نُرجع للمستخدم روابط المعاينة + الكود
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
        # تصنيف الأخطاء — كل خطأ يحصل على رمز الحالة المناسب
        error_text = str(e)
        trace = traceback.format_exc()
        lower = error_text.lower()

        if "429" in lower or "rate" in lower:
            status, msg = 429, "Rate limited by provider"
        elif "402" in lower or "credit" in lower:
            status, msg = 402, "Credits exhausted"        # نفد رصيد الـ API
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


# =====================================================================
# Middleware للتسجيل (Debug)
# =====================================================================
# هذا الـ middleware يطبع كل طلب وردّه في الـ console
# مفيد جدًا أثناء التطوير لمتابعة ما يحصل
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
