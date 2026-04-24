from __future__ import annotations

import os
import re
import json
import asyncio
from pathlib import Path
from typing import List, Tuple, Any, Dict

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# =========================
# CONFIG
# =========================
# FAST_MODELS:
# نماذج أسرع، مناسبة لمهام التخطيط أو المهام الأخف
# Google models (no :free) route through OpenRouter's BYOK feature when the
# user has added a Google AI Studio key at openrouter.ai/settings/integrations.
# That gives them ~1,500 Gemini requests/day free (charged against their Google
# quota, not billed by OpenRouter). Free :free models remain as safety net.
FAST_MODELS = [
    "google/gemini-2.5-flash-lite",               # BYOK via Google AI Studio — very fast
    "google/gemini-2.0-flash-001",                # BYOK — reliable fast fallback
    "google/gemma-3-27b-it:free",                 # OpenRouter free pool fallback
    "meta-llama/llama-3.3-70b-instruct:free",     # last resort
]

# STRONG_MODELS — for full HTML generation
STRONG_MODELS = [
    "google/gemini-2.5-flash",                    # BYOK — fast + high quality
    "google/gemini-2.5-pro",                      # BYOK — best quality when flash isn't enough
    "qwen/qwen3-coder:free",                      # Free pool fallback (coder-tuned)
    "openai/gpt-oss-120b:free",                   # Free pool fallback
    "meta-llama/llama-3.3-70b-instruct:free",     # last resort
]

# عدد النماذج التي نجربها كحد أقصى في الـ fallback
MAX_FALLBACK = 6

# مهلة الانتظار لكل استدعاء نموذج بالثواني — free models are slower
TIMEOUT = 60


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

# مرحلة الأسئلة التوضيحية — AI يحلل الـ brief ويرجع أسئلة تصميمية للمستخدم
CLARIFY_PROMPT = """You are a design consultant helping a user narrow down the design of a landing page.

Given the user's brief, produce 3 to 5 concise clarifying questions about DESIGN decisions that would shape the final page. Cover dimensions like visual style, color palette, tone, hero treatment, must-include sections, typography, target audience — whichever matter most for this specific brief.

Return ONLY valid JSON in this EXACT shape (no prose, no markdown fences, no explanation):

{
  "questions": [
    {
      "key": "short_snake_case_key",
      "question": "Full question text (end with ?)",
      "multi": false,
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}

RULES:
- Produce 3 to 5 questions total.
- Each question has 3 to 5 options, each option under 24 characters.
- Set "multi": true only for questions where picking multiple makes sense (e.g. sections to include).
- Questions must be about DESIGN (how it looks/feels), not about business logic.
- Keep options opinionated and distinct — avoid overlap.
- Return ONLY the JSON object. Nothing before or after it.
"""

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
# CLARIFY PIPELINE
# =========================
# تأخذ brief وترجع قائمة أسئلة تصميمية (JSON)

def _extract_json_object(text: str) -> dict:
    """Best-effort extraction of the first JSON object from a model's output."""
    # Strip common markdown fences
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    # Find first { ... } block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError("no JSON object found in model output")
    return json.loads(match.group(0))


async def clarify_brief(user_query: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    raw, model, logs = await run_with_fallback(
        "clarify",
        FAST_MODELS,
        CLARIFY_PROMPT,
        user_query,
        2000,
    )

    try:
        data = _extract_json_object(raw)
    except (ValueError, json.JSONDecodeError) as e:
        logs.append(f"[clarify] JSON parse failed: {e}")
        raise Exception(f"clarify: could not parse model output: {e}")

    raw_questions = data.get("questions") or []
    questions: List[Dict[str, Any]] = []
    for q in raw_questions:
        if not isinstance(q, dict):
            continue
        question_text = str(q.get("question", "")).strip()
        options = q.get("options") or []
        if not question_text or not isinstance(options, list) or len(options) < 2:
            continue
        questions.append({
            "key": str(q.get("key") or f"q{len(questions) + 1}")[:40],
            "question": question_text[:200],
            "multi": bool(q.get("multi", False)),
            "options": [str(o)[:60] for o in options if str(o).strip()][:6],
        })

    if not questions:
        raise Exception("clarify: model returned no valid questions")

    return questions[:5], logs


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