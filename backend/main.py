import os
import json
import math
import time
from threading import Lock
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'bloom.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
JWT_SECRET = os.getenv("JWT_SECRET", "local-demo-secret-change-before-deployment")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini").strip()
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
passwords = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    checkins: Mapped[list["Checkin"]] = relationship(back_populates="owner", cascade="all, delete-orphan")

class Checkin(Base):
    __tablename__ = "checkins"
    __table_args__ = (UniqueConstraint("user_id", "day", name="one_checkin_per_user_per_day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    sleep: Mapped[float] = mapped_column(Float)
    activity: Mapped[int] = mapped_column(Integer)
    stress: Mapped[int] = mapped_column(Integer)
    meals: Mapped[int] = mapped_column(Integer)
    owner: Mapped[User] = relationship(back_populates="checkins")

Base.metadata.create_all(engine)
app = FastAPI(title="Bloom Wellness API", version="1.0.0", description="Account and daily lifestyle check-in API for the Bloom demo.")
app.add_middleware(CORSMiddleware, allow_origins=[FRONTEND_ORIGIN], allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE.parent / "dist"))
if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=72)

class LoginInput(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=72)

class CheckinInput(BaseModel):
    date: date
    sleep: float = Field(ge=0, le=14)
    activity: int = Field(ge=0, le=7)
    stress: int = Field(ge=1, le=5)
    meals: int = Field(ge=1, le=5)

class DiabetesResearchInput(BaseModel):
    age: int = Field(ge=18, le=79)
    male: bool
    bmi: float = Field(ge=13.7, le=49.9)
    waist_cm: float = Field(ge=36.9, le=130)
    exercise_habit: bool
    hba1c_percent: float = Field(ge=3.7, le=6.4)
    fasting_glucose_mg_dl: float = Field(ge=51, le=109)
    fatty_liver: bool

class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=1200)

class ChatInput(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    consent: bool

def db_session():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def user_view(user: User): return {"id": user.id, "name": user.name, "email": user.email, "is_admin": bool(ADMIN_EMAIL and user.email.strip().lower() == ADMIN_EMAIL)}
def token_for(user: User):
    token = jwt.encode({"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": user_view(user)}

def current_user(token: str = Depends(oauth), db: Session = Depends(db_session)) -> User:
    try: user_id = int(jwt.decode(token, JWT_SECRET, algorithms=["HS256"]).get("sub", ""))
    except (JWTError, ValueError): raise HTTPException(status_code=401, detail="Please sign in again.")
    user = db.get(User, user_id)
    if not user: raise HTTPException(status_code=401, detail="Account not found.")
    return user

def require_admin(user: User = Depends(current_user)) -> User:
    if not ADMIN_EMAIL or user.email.strip().lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Owner access is not enabled for this account.")
    return user

def checkin_view(item: Checkin):
    return {"id": item.id, "date": item.day.isoformat(), "sleep": item.sleep, "activity": item.activity, "stress": item.stress, "meals": item.meals}

def trend_projection(items: list[Checkin], field: str, floor: float, ceiling: float):
    first_day = items[0].day
    xs = [(item.day - first_day).days for item in items]
    ys = [float(getattr(item, field)) for item in items]
    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    variance = sum((x - x_mean) ** 2 for x in xs)
    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys)) / variance if variance else 0.0
    recent = ys[-7:]
    current = sum(recent) / len(recent)
    projected = max(floor, min(ceiling, current + slope * 30))
    change = projected - current
    tolerance = 0.35 if field in {"sleep", "stress", "meals"} else 1.0
    direction = "rising" if change > tolerance else "falling" if change < -tolerance else "steady"
    return {"current": round(current, 1), "projected": round(projected, 1), "change": round(change, 1), "direction": direction}

@app.get("/api/health")
def health(): return {"status": "ok"}

CHAT_REQUESTS: dict[int, list[float]] = {}
CHAT_REQUESTS_LOCK = Lock()
CHAT_SYSTEM_PROMPT = """You are Bloom Wellness Guide, a general wellness and app-navigation assistant. Be calm, respectful, nonjudgmental, brief, and use plain language. You are not a clinician. Never diagnose a disease, say what disease a person probably has, provide a personal disease probability, prescribe or change medicine, or present your answer as medical advice. Explain that symptoms can have many causes. Give low-risk general wellness information only, and suggest a qualified health professional when a concern is persistent, worsening, or worrying. Do not ask for names, email addresses, exact locations, account credentials, or unnecessary identifying health details. If someone describes an immediate medical emergency (for example severe chest pain, trouble breathing, or sudden one-sided weakness) or may act on self-harm thoughts, tell them to contact their local emergency service or go to an emergency department now; encourage them to contact a trusted person. For substance use, be nonjudgmental and note that withdrawal from alcohol or sedatives may require medical supervision. Do not claim access to Bloom account records; answer only from the current chat. If asked to predict every disease, explain that Bloom does not do that and that separate validated tools are required."""

def allow_chat_request(user_id: int) -> bool:
    now = time.monotonic()
    with CHAT_REQUESTS_LOCK:
        recent = [stamp for stamp in CHAT_REQUESTS.get(user_id, []) if now - stamp < 3600]
        if len(recent) >= 10:
            CHAT_REQUESTS[user_id] = recent
            return False
        recent.append(now)
        CHAT_REQUESTS[user_id] = recent
        return True

@app.get("/api/chat/status")
def chat_status(_user: User = Depends(current_user)):
    return {"available": bool(OPENAI_API_KEY)}

@app.post("/api/chat")
def wellness_chat(data: ChatInput, user: User = Depends(current_user)):
    if not data.consent:
        raise HTTPException(status_code=400, detail="Consent is required before sending a message to the AI provider.")
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="The AI guide is not configured yet.")
    if not allow_chat_request(user.id):
        raise HTTPException(status_code=429, detail="You have reached the chat demo limit. Please try again later.")
    payload = {
        "model": OPENAI_MODEL,
        "instructions": CHAT_SYSTEM_PROMPT,
        "input": [{"role": item.role, "content": item.content} for item in data.messages[-10:]],
        "store": False,
        "max_output_tokens": 450,
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=25) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 429:
            raise HTTPException(status_code=503, detail="The AI service is busy or its API quota is unavailable. Please try later.") from exc
        raise HTTPException(status_code=502, detail="The AI service could not answer right now.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError):
        raise HTTPException(status_code=502, detail="The AI service could not be reached right now.")
    reply = result.get("output_text", "")
    if not reply:
        reply = "\n".join(
            part.get("text", "")
            for item in result.get("output", [])
            for part in item.get("content", [])
            if part.get("type") == "output_text"
        ).strip()
    if not reply:
        raise HTTPException(status_code=502, detail="The AI service returned an empty reply. Please try again.")
    return {"reply": reply}

@app.get("/", include_in_schema=False)
def frontend():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.is_file(): return FileResponse(index_file)
    return {"message": "Bloom API is running. Use the Vite development server to view the app."}

@app.post("/api/auth/register", status_code=201)
def register(data: RegisterInput, db: Session = Depends(db_session)):
    email = data.email.strip().lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]: raise HTTPException(422, "Enter a valid email address.")
    if db.scalar(select(User).where(User.email == email)): raise HTTPException(409, "An account with that email already exists.")
    user = User(name=data.name.strip(), email=email, password_hash=passwords.hash(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return token_for(user)

@app.post("/api/auth/login")
def login(data: LoginInput, db: Session = Depends(db_session)):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    if not user or not passwords.verify(data.password, user.password_hash): raise HTTPException(401, "Email or password is incorrect.")
    return token_for(user)

@app.get("/api/auth/me")
def me(user: User = Depends(current_user)): return user_view(user)

@app.get("/api/checkins")
def list_checkins(limit: int = 90, user: User = Depends(current_user), db: Session = Depends(db_session)):
    limit = max(1, min(limit, 365))
    items = db.scalars(select(Checkin).where(Checkin.user_id == user.id).order_by(Checkin.day.desc()).limit(limit)).all()
    return [checkin_view(item) for item in reversed(items)]

@app.get("/api/admin/users")
def admin_users(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), _admin: User = Depends(require_admin), db: Session = Depends(db_session)):
    total = db.scalar(select(func.count(User.id))) or 0
    rows = db.execute(
        select(User, func.count(Checkin.id))
        .outerjoin(Checkin, Checkin.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return {"total": total, "users": [{"id": user.id, "name": user.name, "email": user.email, "created_at": user.created_at.isoformat(), "checkin_count": count} for user, count in rows]}

@app.get("/api/admin/users/{user_id}/checkins")
def admin_user_checkins(user_id: int, limit: int = Query(30, ge=1, le=100), offset: int = Query(0, ge=0), _admin: User = Depends(require_admin), db: Session = Depends(db_session)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    total = db.scalar(select(func.count(Checkin.id)).where(Checkin.user_id == user_id)) or 0
    items = db.scalars(
        select(Checkin)
        .where(Checkin.user_id == user_id)
        .order_by(Checkin.day.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return {"total": total, "user": {"id": user.id, "name": user.name, "email": user.email, "created_at": user.created_at.isoformat()}, "checkins": [checkin_view(item) for item in items]}

@app.get("/api/outlook")
def lifestyle_outlook(user: User = Depends(current_user), db: Session = Depends(db_session)):
    items = db.scalars(select(Checkin).where(Checkin.user_id == user.id).order_by(Checkin.day.desc()).limit(30)).all()
    items = list(reversed(items))
    span = (items[-1].day - items[0].day).days if len(items) > 1 else 0
    if len(items) < 7 or span < 6:
        return {"ready": False, "entries_used": len(items), "entries_needed": max(0, 7 - len(items)), "message": "Add at least 7 daily check-ins across a week to see an early personal trend projection."}
    # These are transparent, app-defined habit markers. They are not validated
    # medical cutoffs and must never be presented as disease-risk thresholds.
    fields = [
        ("sleep", "Sleep", "hours", 0, 14, 7, "higher", "Short sleep pattern", "Your projected sleep average may stay below the app's 7-hour reference."),
        ("activity", "Active days", "days per week", 0, 7, 4, "higher", "Low movement pattern", "Your logged active days may stay below the app's 4-day marker."),
        ("stress", "Stress", "out of 5", 1, 5, 3, "lower", "Higher stress pattern", "Your self-rated stress may remain at or above 3 out of 5."),
        ("meals", "Meal balance", "out of 5", 1, 5, 3, "higher", "Meal-balance pattern", "Your meal-balance rating may remain below 3 out of 5."),
    ]
    projections = []
    for field, title, unit, floor, ceiling, marker, favorable, risk_title, risk_message in fields:
        result = trend_projection(items, field, floor, ceiling)
        favorable_direction = "falling" if favorable == "lower" else "rising"
        projected_needs_attention = result["projected"] >= marker if favorable == "lower" else result["projected"] < marker
        if projected_needs_attention:
            signal = "improving" if result["direction"] == favorable_direction else "watch"
            interpretation = risk_message
        elif result["direction"] == favorable_direction:
            signal = "improving"
            interpretation = "This habit is moving toward the app's reference in the projection."
        elif result["direction"] != "steady":
            signal = "watch"
            interpretation = "This habit is trending toward the app's attention marker in the projection."
        else:
            signal = "steady"
            interpretation = "This habit stays near or within the app's reference in the projection."
        projections.append({
            "key": field, "title": title, "risk_title": risk_title, "unit": unit,
            "attention_marker": marker, **result, "signal": signal,
            "interpretation": interpretation,
        })
    return {
        "ready": True,
        "entries_used": len(items),
        "projections": projections,
        "method": "A transparent straight-line trend fitted to up to 30 of your recent self-reported entries. The markers are app-defined habit references, not clinical cutoffs.",
        "disclaimer": "These signals describe possible future habit patterns only. They are not disease probabilities, a diagnosis, or medical advice.",
    }

@app.post("/api/research/diabetes-5-year")
def diabetes_research_estimate(data: DiabetesResearchInput, user: User = Depends(current_user)):
    """Research-only cohort estimate; request values are not written to the database."""
    model_path = BASE / "diabetes_research_model.json"
    if not model_path.is_file():
        raise HTTPException(status_code=503, detail="The research model is not installed.")
    with model_path.open("r", encoding="utf-8") as model_file:
        model = json.load(model_file)
    values = [data.age, int(data.male), data.bmi, data.waist_cm, int(data.exercise_habit), data.hba1c_percent, data.fasting_glucose_mg_dl, int(data.fatty_liver)]
    linear_predictor = sum(((value - model["means"][i]) / model["scales"][i]) * model["coefficients"][i] for i, value in enumerate(values))
    relative_hazard = math.exp(max(-30.0, min(30.0, linear_predictor)))
    hazard = model["baseline_cumulative_hazard_5y"] * relative_hazard
    probability = 1.0 - math.exp(-hazard)
    return {
        "estimate_percent": round(probability * 100, 1),
        "horizon_years": 5,
        "model_type": model["model_type"],
        "validation": model["validation"],
        "cohort_summary": model["cohort_summary"],
        "notice": model["limitations"],
        "saved": False,
    }

@app.post("/api/checkins")
def save_checkin(data: CheckinInput, user: User = Depends(current_user), db: Session = Depends(db_session)):
    if data.date > date.today(): raise HTTPException(422, "Check-in date cannot be in the future.")
    item = db.scalar(select(Checkin).where(Checkin.user_id == user.id, Checkin.day == data.date))
    if item is None: item = Checkin(user_id=user.id, day=data.date); db.add(item)
    item.sleep = data.sleep; item.activity = data.activity; item.stress = data.stress; item.meals = data.meals
    db.commit(); db.refresh(item)
    return checkin_view(item)

@app.delete("/api/account", status_code=204)
def delete_account(user: User = Depends(current_user), db: Session = Depends(db_session)):
    db.delete(user); db.commit(); return None
