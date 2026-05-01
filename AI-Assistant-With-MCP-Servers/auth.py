# =====================================================================
# auth.py
# هذا الملف مسؤول عن كل ما يخص المصادقة (تسجيل الدخول/التسجيل)
# المهام الرئيسية:
#   1. تشفير كلمات المرور قبل تخزينها
#   2. التحقق من كلمة المرور عند تسجيل الدخول
#   3. البحث عن المستخدمين في قاعدة البيانات
#   4. إنشاء حسابات جديدة
#   5. التحقق من بيانات الدخول (email + password)
# =====================================================================

# مكتبة bcrypt — لتشفير كلمات المرور بطريقة آمنة (one-way hashing)
import bcrypt

# Session: نوع جلسة قاعدة البيانات (نمررها كوسيط لكل دالة تتعامل مع البيانات)
from sqlalchemy.orm import Session

# استيراد جدول المستخدمين الذي عرّفناه في database.py
from database import User


# =====================================================================
# تشفير كلمة المرور
# نأخذ كلمة المرور كنص عادي ونرجع نسخة مشفرة
# bcrypt يضيف "ملحًا" (salt) عشوائيًا في كل مرة ليزيد الأمان
# =====================================================================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# =====================================================================
# التحقق من صحة كلمة المرور
# نقارن كلمة المرور التي أدخلها المستخدم مع النسخة المشفرة في قاعدة البيانات
# يرجع True إن كانت متطابقة، False في غير ذلك
# =====================================================================
def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        # في حال كان الهاش غير صالح أو فيه مشكلة في التشفير
        return False


# =====================================================================
# دوال البحث عن المستخدمين
# لكل دالة طريقة بحث مختلفة (بالبريد، باسم المستخدم، أو بالـ ID)
# =====================================================================

# البحث عن مستخدم بواسطة البريد الإلكتروني
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


# البحث عن مستخدم بواسطة اسم المستخدم
def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


# البحث عن مستخدم بواسطة المعرف الرقمي (ID)
def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


# =====================================================================
# إنشاء مستخدم جديد (تسجيل حساب)
# الخطوات:
#   1. التأكد أن البريد غير مستخدم مسبقًا
#   2. التأكد أن اسم المستخدم غير مستخدم مسبقًا
#   3. تشفير كلمة المرور
#   4. حفظ المستخدم الجديد في قاعدة البيانات
# يرجع زوجًا (المستخدم الجديد، رسالة الخطأ) — أحدهما يكون None
# =====================================================================
def create_user(db: Session, username: str, email: str, password: str):
    # هل البريد مسجّل من قبل؟
    existing_email = get_user_by_email(db, email)
    if existing_email:
        return None, "Email already exists"

    # هل اسم المستخدم محجوز؟
    existing_username = get_user_by_username(db, username)
    if existing_username:
        return None, "Username already exists"

    # إنشاء كائن المستخدم الجديد بكلمة مرور مشفّرة
    new_user = User(
        username=username,
        email=email,
        password_hash=hash_password(password)
    )

    # إضافة المستخدم لجلسة قاعدة البيانات ثم حفظه فعليًا
    db.add(new_user)
    db.commit()
    # refresh تجلب آخر القيم من قاعدة البيانات (مثل الـ ID المُولّد تلقائيًا)
    db.refresh(new_user)

    return new_user, None


# =====================================================================
# التحقق من بيانات تسجيل الدخول
# الخطوات:
#   1. البحث عن المستخدم بالبريد
#   2. التحقق من كلمة المرور
# يرجع المستخدم إذا نجح، أو None إذا فشل
# =====================================================================
def authenticate_user(db: Session, email: str, password: str):
    # نبحث عن المستخدم في قاعدة البيانات
    user = get_user_by_email(db, email)
    if not user:
        # لا يوجد مستخدم بهذا البريد
        return None

    # نقارن كلمة المرور المُدخلة مع المُشفّرة المحفوظة
    if not verify_password(password, user.password_hash):
        # كلمة المرور خاطئة
        return None

    # كل شيء سليم — نُرجع المستخدم
    return user
