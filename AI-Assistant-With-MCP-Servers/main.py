import os
import re
import asyncio
from pathlib import Path
from typing import List, Tuple, Any

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# =========================
# CONFIG
# =========================
# FAST_MODELS:
# نماذج أسرع، مناسبة لمهام التخطيط أو المهام الأخف
FAST_MODELS = [
    "z-ai/glm-5.1",
    "openai/gpt-5.4-mini",
]

# STRONG_MODELS:
# نماذج أقوى، مناسبة لتوليد HTML النهائي بجودة أفضل
STRONG_MODELS = [
    "openai/gpt-5.4",
    "openai/gpt-4o-mini",
]

# كم عدد النماذج التي نجربها كحد أقصى في حالة الـ fallback
MAX_FALLBACK = 2

# مهلة الانتظار لكل استدعاء نموذج بالثواني
TIMEOUT = 25


# =========================
# LLM FACTORY
# =========================
# هذه الدالة تنشئ كائن LLM جاهز للاستخدام عبر OpenRouter
def create_llm(model: str, max_tokens: int | None = None):
    # تحميل متغيرات البيئة من ملف .env
    load_dotenv()

    # قراءة API key الخاصة بـ OpenRouter
    api_key = os.getenv("OPENROUTER_API_KEY")

    # إذا المفتاح غير موجود، نرمي خطأ واضح
    if not api_key:
        raise Exception("Missing OPENROUTER_API_KEY")

    # إنشاء كائن ChatOpenAI لكن باستخدام OpenRouter كـ base_url
    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,   # عشوائية منخفضة نسبيًا للحصول على نتائج أكثر استقرارًا
        max_tokens=max_tokens,
        default_headers={
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "efficient-multi-agent-builder"
        }
    )


# =========================
# HELPERS
# =========================

# استخراج النص من الرد
# بعض الردود تكون فيها خاصية content، وبعضها لا
def extract_text(res: Any) -> str:
    return res.content if hasattr(res, "content") else str(res)


# تحديد إن كان طلب المستخدم بسيطًا أم لا
# الهدف: الطلبات البسيطة تذهب مباشرة للبناء
# والطلبات المعقدة تمر أولًا على مرحلة plan+design
def is_simple_request(q: str) -> bool:
    q = q.lower()
    return len(q) < 120 or any(
        k in q for k in ["simple", "basic", "one page"]
    )


# فحص إذا كان HTML يحتاج إصلاح
# مثلًا لو لا يوجد DOCTYPE أو لا يوجد style أو لا توجد نهاية </html>
def needs_fix(html: str) -> bool:
    return (
        "<!DOCTYPE html>" not in html or
        "<style>" not in html or
        not html.strip().lower().endswith("</html>")
    )


# فحص إذا كان الإخراج مقطوعًا
# هنا فقط نفحص هل انتهى الملف بـ </html> أم لا
def is_truncated(html: str) -> bool:
    return not html.strip().lower().endswith("</html>")


# استخراج الجزء الخاص بالـ HTML فقط من رد النموذج
# لأن بعض النماذج قد تضيف شرحًا زائدًا مع الكود
def extract_html(text: str) -> str:
    # نحاول أولًا استخراج كل شيء يبدأ من <!DOCTYPE html>
    match = re.search(r"(<!DOCTYPE html>.*)", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)

    # إذا لم نجد DOCTYPE، نحاول استخراج ما بين <html> و </html>
    html_match = re.search(r"(<html.*</html>)", text, re.DOTALL | re.IGNORECASE)
    if html_match:
        return html_match.group(1)

    # إذا لم نجد HTML صريح، نلف النص داخل صفحة HTML بسيطة
    # حتى لا ينهار التطبيق
    return f"<html><body><pre>{text}</pre></body></html>"


# حفظ HTML الناتج داخل مجلد result
def save_html(html: str) -> str:
    path = Path("result")
    path.mkdir(exist_ok=True)

    # توليد اسم ملف جديد بشكل تصاعدي
    idx = len(list(path.glob("result_*.html"))) + 1
    file = path / f"result_{idx}.html"

    # حفظ الملف بترميز UTF-8
    file.write_text(html, encoding="utf-8")

    return str(file)


# =========================
# CORE EXECUTION
# =========================

# هذه الدالة تنفذ مرحلة واحدة من الـ pipeline مع fallback
# مثال:
# - plan+design
# - builder
# - fixer
#
# إذا فشل نموذج، تجرب النموذج الذي بعده
async def run_with_fallback(
    stage: str,
    models: List[str],
    system: str,
    user: str,
    max_tokens: int | None
) -> Tuple[str, str, List[str]]:

    # logs لتسجيل ما الذي حصل في هذه المرحلة
    logs = []

    # نجرب النماذج حسب العدد المسموح به في MAX_FALLBACK
    for model in models[:MAX_FALLBACK]:
        llm = create_llm(model, max_tokens)

        try:
            # إرسال system prompt + user prompt للنموذج
            res = await asyncio.wait_for(
                llm.ainvoke([
                    SystemMessage(content=system),
                    HumanMessage(content=user)
                ]),
                timeout=TIMEOUT
            )

            # إذا نجح، نسجل النجاح ونرجع النتيجة
            logs.append(f"[{stage}] {model} success")
            return extract_text(res), model, logs

        except Exception as e:
            # إذا فشل هذا النموذج، نسجل الفشل وننتقل لغيره
            logs.append(f"[{stage}] {model} failed: {str(e)}")
            continue

    # إذا فشلت كل النماذج، نرمي خطأ شامل
    raise Exception(f"{stage} failed across fallback models\n" + "\n".join(logs))


# =========================
# PROMPTS
# =========================

# Prompt خاص بمرحلة التخطيط والتصميم
# المفروض لا يرجع HTML بل فقط خطة تصميمية
PLAN_DESIGN_PROMPT = """
You are a planner + designer.

Return:
- layout structure
- sections
- UX flow
- color scheme
- typography

Do NOT generate HTML.
"""

# Prompt خاص بمرحلة البناء
# هذا هو الذي يطلب من النموذج إنشاء HTML كامل
BUILDER_PROMPT = """
You are an expert frontend engineer.

Generate a COMPLETE landing page.

STRICT:
- Full HTML document
- Start with <!DOCTYPE html>
- End with </html>
- Include full CSS
- Responsive design
- No truncation
- No explanations

Return ONLY HTML.
"""

# Prompt خاص بمرحلة الإصلاح
# إذا كان HTML ناقصًا أو فيه مشكلة بنيوية
FIXER_PROMPT = """
Fix and complete this HTML.

Ensure:
- Proper closing tags
- Full structure
- Responsive layout
- Clean UI

Return ONLY HTML.
"""


# =========================
# MAIN PIPELINE
# =========================

# هذه هي الدالة الرئيسية التي يستدعيها api.py
# تأخذ user_query وترجع:
# - file_path
# - html
# - debug_message
async def ai_assistant(user_query: str):

    # debug لتجميع كل سجلات المراحل
    debug = []

    # ===== SIMPLE PATH =====
    # إذا كان الطلب بسيطًا:
    # نتجاوز مرحلة التخطيط ونذهب مباشرة للبناء
    if is_simple_request(user_query):
        html_raw, model, logs = await run_with_fallback(
            "builder",
            STRONG_MODELS,
            BUILDER_PROMPT,
            user_query,
            None
        )

        debug += logs
        html = extract_html(html_raw)

    # ===== COMPLEX PATH =====
    # إذا كان الطلب معقدًا:
    # 1) نولد خطة
    # 2) نرسل الطلب + الخطة إلى مرحلة البناء
    else:
        plan, model1, logs1 = await run_with_fallback(
            "plan+design",
            FAST_MODELS,
            PLAN_DESIGN_PROMPT,
            user_query,
            8000
        )

        debug += logs1

        html_raw, model2, logs2 = await run_with_fallback(
            "builder",
            STRONG_MODELS,
            BUILDER_PROMPT,
            f"{user_query}\n\nPlan:\n{plan}",
            8000
        )

        debug += logs2
        html = extract_html(html_raw)

    # ===== RETRY IF TRUNCATED =====
    # إذا كان الإخراج مقطوعًا، نحاول مرة أخرى مع تنبيه أقوى للنموذج
    if is_truncated(html):
        retry_raw, _, retry_logs = await run_with_fallback(
            "builder-retry",
            STRONG_MODELS,
            BUILDER_PROMPT + "\nIMPORTANT: previous output was truncated. Return FULL HTML.",
            user_query,
            8000
        )

        debug += retry_logs
        html = extract_html(retry_raw)

    # ===== OPTIONAL FIX =====
    # إذا كان HTML ما يزال يحتاج إصلاحًا،
    # نرسله إلى fixer
    if needs_fix(html):
        fixed, _, fix_logs = await run_with_fallback(
            "fixer",
            FAST_MODELS,
            FIXER_PROMPT,
            html,
            8000
        )

        debug += fix_logs
        html = extract_html(fixed)

    # حفظ الملف النهائي داخل مجلد result
    file_path = save_html(html)

    # إعادة البيانات النهائية إلى api.py
    return {
        "mode": "adaptive-multi-agent",
        "file_path": file_path,
        "html": html,
        "debug_message": "\n".join(debug)
    }