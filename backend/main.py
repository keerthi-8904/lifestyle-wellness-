import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker
from fastapi.staticfiles import StaticFiles

BASE = Path(__file__).resolve().parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'bloom.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
JWT_SECRET = os.getenv("JWT_SECRET", "local-demo-secret-change-before-deployment")
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

def db_session():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def user_view(user: User): return {"id": user.id, "name": user.name, "email": user.email}
def token_for(user: User):
    token = jwt.encode({"sub": str(user.id), "exp": datetime.now(timezone.utc) + timedelta(days=7)}, JWT_SECRET, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer", "user": user_view(user)}

def current_user(token: str = Depends(oauth), db: Session = Depends(db_session)) -> User:
    try: user_id = int(jwt.decode(token, JWT_SECRET, algorithms=["HS256"]).get("sub", ""))
    except (JWTError, ValueError): raise HTTPException(status_code=401, detail="Please sign in again.")
    user = db.get(User, user_id)
    if not user: raise HTTPException(status_code=401, detail="Account not found.")
    return user

def checkin_view(item: Checkin):
    return {"id": item.id, "date": item.day.isoformat(), "sleep": item.sleep, "activity": item.activity, "stress": item.stress, "meals": item.meals}

@app.get("/api/health")
def health(): return {"status": "ok"}

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
