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

FAST_MODELS = [
    "qwen/qwen3-coder",
    "anthropic/claude-3-haiku",
]

STRONG_MODELS = [
    "anthropic/claude-3.5-haiku",
    "openai/gpt-4o-mini",
]

MAX_FALLBACK = 2
TIMEOUT = 25


# =========================
# LLM FACTORY
# =========================

def create_llm(model: str, max_tokens: int | None = None):
    load_dotenv()
    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        raise Exception("Missing OPENROUTER_API_KEY")

    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,
        max_tokens=max_tokens,
        default_headers={
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "efficient-multi-agent-builder"
        }
    )


# =========================
# HELPERS
# =========================

def extract_text(res: Any) -> str:
    return res.content if hasattr(res, "content") else str(res)


def is_simple_request(q: str) -> bool:
    q = q.lower()
    return len(q) < 120 or any(k in q for k in ["simple", "landing page", "basic", "one page"])


def needs_fix(html: str) -> bool:
    return (
        "<!DOCTYPE html>" not in html or
        "<style>" not in html or
        not html.strip().lower().endswith("</html>")
    )


def is_truncated(html: str) -> bool:
    return not html.strip().lower().endswith("</html>")


def extract_html(text: str) -> str:
    match = re.search(r"(<!DOCTYPE html>.*)", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)

    html_match = re.search(r"(<html.*</html>)", text, re.DOTALL | re.IGNORECASE)
    if html_match:
        return html_match.group(1)

    return f"<html><body><pre>{text}</pre></body></html>"


def save_html(html: str) -> str:
    path = Path("result")
    path.mkdir(exist_ok=True)

    idx = len(list(path.glob("result_*.html"))) + 1
    file = path / f"result_{idx}.html"
    file.write_text(html, encoding="utf-8")

    return str(file)


# =========================
# CORE EXECUTION
# =========================

async def run_with_fallback(
    stage: str,
    models: List[str],
    system: str,
    user: str,
    max_tokens: int | None
) -> Tuple[str, str, List[str]]:

    logs = []

    for model in models[:MAX_FALLBACK]:
        llm = create_llm(model, max_tokens)

        try:
            res = await asyncio.wait_for(
                llm.ainvoke([
                    SystemMessage(content=system),
                    HumanMessage(content=user)
                ]),
                timeout=TIMEOUT
            )

            logs.append(f"[{stage}] {model} success")
            return extract_text(res), model, logs

        except Exception as e:
            logs.append(f"[{stage}] {model} failed: {str(e)}")
            continue

    raise Exception(f"{stage} failed across fallback models\n" + "\n".join(logs))


# =========================
# PROMPTS
# =========================

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

async def ai_assistant(user_query: str):

    debug = []

    # ===== SIMPLE PATH =====
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

    file_path = save_html(html)

    return {
        "mode": "adaptive-multi-agent",
        "file_path": file_path,
        "html": html,
        "debug_message": "\n".join(debug)
    }