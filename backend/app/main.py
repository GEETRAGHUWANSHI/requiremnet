from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "analyses.db"

app = FastAPI(title="Requirement Lens API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=20, max_length=100_000)
    source_name: str = "Pasted requirements"


def db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with db() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_name TEXT NOT NULL,
                requirement_text TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )"""
        )


@app.on_event("startup")
def startup() -> None:
    init_db()


def fallback_analysis(text: str) -> dict[str, Any]:
    """Useful offline analysis for demos and development without an API key."""
    lower = text.lower()
    ecommerce = any(word in lower for word in ("cart", "products", "orders", "e-commerce", "payment"))
    features = [
        {"name": "Identity and access", "description": "User registration, login, and secure session management.", "priority": "Must have"},
        {"name": "Product discovery", "description": "Browse and search the product catalogue with useful product details.", "priority": "Must have"},
        {"name": "Order workflow", "description": "Add items to a cart, place orders, and track their fulfilment status.", "priority": "Must have"},
        {"name": "Administration", "description": "Admins manage products and orders from a protected workspace.", "priority": "Must have"},
        {"name": "Notifications", "description": "Send customers timely updates as an order changes state.", "priority": "Should have"},
        {"name": "Payments", "description": "Support a secure online payment flow with clear failure handling.", "priority": "Must have"},
    ] if ecommerce else [
        {"name": "Requirement intake", "description": "Capture and validate the core user inputs.", "priority": "Must have"},
        {"name": "Core workflow", "description": "Implement the primary business flow described by the client.", "priority": "Must have"},
        {"name": "Administration", "description": "Provide authorized users with appropriate management controls.", "priority": "Should have"},
    ]
    functional = [
        "Customers can register and log in.", "Customers can browse products and add them to a cart.",
        "Customers can place, pay for, and track orders.", "Admins can manage products and orders.",
        "The system sends order notifications.",
    ] if ecommerce else [line.strip() for line in text.split(".") if line.strip()][:6]
    non_functional = [
        "The experience should be mobile-friendly and responsive.",
        "Pages and key actions should feel fast under normal load.",
        "Authentication, payments, and personal data must be secure.",
        "Order and payment operations should be reliable and auditable.",
    ]
    missing = [
        "Which payment provider, currencies, and payment methods are required?",
        "What are the order statuses, fulfilment rules, and cancellation/refund policy?",
        "What notification channels and message templates should be supported?",
        "What catalogue size, traffic volume, and performance targets should the system support?",
    ] if ecommerce else [
        "Who are the user roles and what permissions does each role have?",
        "What are the expected scale, integrations, and deployment environment?",
        "What are the success metrics and edge-case business rules?",
    ]
    stories = [
        {"id": "US-01", "title": "Create an account", "as_a": "customer", "i_want": "to register and log in", "so_that": "I can manage my activity securely", "acceptance_criteria": ["Valid details create an account", "Invalid or duplicate details show a clear error", "A logged-in user sees their account state"]},
        {"id": "US-02", "title": "Complete a purchase", "as_a": "customer", "i_want": "to add products to a cart and pay", "so_that": "I can receive the items I need", "acceptance_criteria": ["Cart totals update when quantities change", "A successful payment creates an order", "Payment failure does not create a paid order"]},
        {"id": "US-03", "title": "Manage the catalogue", "as_a": "admin", "i_want": "to manage products and orders", "so_that": "the storefront stays accurate", "acceptance_criteria": ["Only authorized admins can access controls", "Product changes appear in the catalogue", "Order status changes are recorded"]},
    ]
    tests = [
        {"id": "TC-01", "scenario": "Successful registration", "steps": "Submit valid unique customer details", "expected": "Account is created and user can log in", "priority": "High"},
        {"id": "TC-02", "scenario": "Empty cart checkout", "steps": "Open checkout with no items", "expected": "Checkout is blocked with an explanatory message", "priority": "High"},
        {"id": "TC-03", "scenario": "Payment failure", "steps": "Use a declined payment response", "expected": "Order remains unpaid and user can retry", "priority": "High"},
        {"id": "TC-04", "scenario": "Mobile layout", "steps": "Use the application at 375px width", "expected": "Core flows remain usable without horizontal scrolling", "priority": "Medium"},
    ]
    return {
        "project_overview": "A secure, responsive client-facing platform that turns the described business workflow into a dependable digital experience.",
        "objectives": ["Deliver the core customer workflow end-to-end", "Give administrators practical operational controls", "Provide a fast, secure, and mobile-friendly experience"],
        "functional_requirements": functional,
        "non_functional_requirements": non_functional,
        "features": features,
        "missing_information": missing,
        "ambiguous_requirements": ["‘Fast’ needs a measurable response-time target.", "‘Secure’ needs a defined authentication, authorization, and compliance baseline."],
        "contradictions": [],
        "questions_to_ask": missing,
        "user_stories": stories,
        "test_cases": tests,
        "analysis_mode": "offline-demo",
    }


def ai_analysis(text: str) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        return fallback_analysis(text)
    schema_hint = json.dumps(fallback_analysis(text), indent=2)
    prompt = f"""You are a senior product analyst. Analyze the client requirements below and return ONLY valid JSON. Preserve this exact top-level schema and improve every value with evidence from the input: {schema_hint}\n\nCLIENT REQUIREMENTS:\n{text}"""
    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": "Return structured software project documentation as JSON."}, {"role": "user", "content": prompt}],
            temperature=0.2,
        )
        result = json.loads(response.choices[0].message.content or "{}")
        result["analysis_mode"] = "openai"
        return result
    except Exception:
        return fallback_analysis(text)


def save_analysis(source_name: str, text: str, result: dict[str, Any]) -> dict[str, Any]:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat()
    with db() as connection:
        cursor = connection.execute("INSERT INTO analyses (source_name, requirement_text, result_json, created_at) VALUES (?, ?, ?, ?)", (source_name, text, json.dumps(result), created_at))
        return {"id": cursor.lastrowid, "source_name": source_name, "created_at": created_at, "result": result, "requirement_text": text}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "ai_mode": "openai" if os.getenv("OPENAI_API_KEY") else "offline-demo"}


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    return save_analysis(request.source_name, request.text.strip(), ai_analysis(request.text.strip()))


@app.post("/api/extract")
async def extract(file: UploadFile = File(...)) -> dict[str, str]:
    name = file.filename or "uploaded document"
    suffix = Path(name).suffix.lower()
    if suffix not in {".txt", ".pdf"}:
        raise HTTPException(400, "Only PDF and TXT files are supported.")
    content = await file.read()
    try:
        if suffix == ".txt":
            text = content.decode("utf-8")
        elif PdfReader is not None:
            import io
            text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(content)).pages)
        else:
            raise HTTPException(500, "PDF processing dependency is unavailable.")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(400, f"Could not read this document: {error}") from error
    if not text.strip():
        raise HTTPException(400, "No readable text was found in this document.")
    return {"text": text, "source_name": name}


@app.get("/api/analyses")
def list_analyses() -> list[dict[str, Any]]:
    init_db()
    with db() as connection:
        rows = connection.execute("SELECT id, source_name, created_at, result_json FROM analyses ORDER BY id DESC").fetchall()
    return [{"id": row["id"], "source_name": row["source_name"], "created_at": row["created_at"], "result": json.loads(row["result_json"])} for row in rows]


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: int) -> dict[str, Any]:
    init_db()
    with db() as connection:
        row = connection.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Analysis not found.")
    return {"id": row["id"], "source_name": row["source_name"], "created_at": row["created_at"], "requirement_text": row["requirement_text"], "result": json.loads(row["result_json"])}
