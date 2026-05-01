# =====================================================================
# database.py
# هذا الملف مسؤول عن إعداد قاعدة البيانات (SQLite) باستخدام SQLAlchemy
# يحتوي على:
#   1. إنشاء الاتصال بقاعدة البيانات
#   2. تعريف جلسة العمل (Session)
#   3. تعريف جدول المستخدمين (User)
#   4. دالة لتهيئة قاعدة البيانات عند أول تشغيل
# =====================================================================

# استيراد الأدوات اللازمة من مكتبة SQLAlchemy
# create_engine: لإنشاء الاتصال بقاعدة البيانات
# Column, Integer, String: لتعريف الأعمدة وأنواعها
from sqlalchemy import create_engine, Column, Integer, String

# declarative_base: الأساس الذي ترث منه كل جداول قاعدة البيانات
# sessionmaker: لصنع جلسات للتعامل مع البيانات (إضافة/قراءة/تعديل/حذف)
from sqlalchemy.orm import declarative_base, sessionmaker


# عنوان ملف قاعدة البيانات — هنا نستخدم SQLite وهي قاعدة بيانات بسيطة
# تُحفظ في ملف واحد اسمه users.db داخل مجلد المشروع
DATABASE_URL = "sqlite:///./users.db"


# إنشاء "المحرك" (engine) المسؤول عن التواصل مع قاعدة البيانات
# الخيار check_same_thread=False ضروري مع FastAPI لأن الطلبات قد تأتي من خيوط (threads) مختلفة
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)


# إعداد "صانع الجلسات" — كل طلب من المستخدم سيفتح جلسة خاصة به
# autocommit=False: لا تحفظ تلقائيًا، نحفظ يدويًا بعد التأكد
# autoflush=False:  لا تنسخ التغييرات لقاعدة البيانات قبل أمر صريح
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


# Base هي الفئة الأساسية التي ترث منها كل جداولنا
Base = declarative_base()


# =====================================================================
# جدول المستخدمين (Users Table)
# هنا نعرّف شكل الجدول الذي يحفظ بيانات حسابات المستخدمين
# =====================================================================
class User(Base):
    # اسم الجدول داخل قاعدة البيانات
    __tablename__ = "users"

    # عمود المعرف (ID) — رقم تسلسلي تلقائي ومفتاح أساسي
    id = Column(Integer, primary_key=True, index=True)

    # اسم المستخدم — يجب أن يكون فريدًا (لا يتكرر) ومطلوبًا
    username = Column(String, unique=True, index=True, nullable=False)

    # البريد الإلكتروني — فريد ومطلوب
    email = Column(String, unique=True, index=True, nullable=False)

    # كلمة المرور المُشفّرة — لا نحفظ كلمة المرور كنص صريح أبدًا
    password_hash = Column(String, nullable=False)


# =====================================================================
# دالة init_db
# تُستدعى مرة واحدة عند بدء تشغيل التطبيق
# مهمتها: إنشاء الجداول داخل قاعدة البيانات إن لم تكن موجودة
# =====================================================================
def init_db():
    Base.metadata.create_all(bind=engine)
