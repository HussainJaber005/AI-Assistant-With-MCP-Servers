from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, username: str, email: str, password: str):
    existing_email = get_user_by_email(db, email)
    if existing_email:
        return None, "Email already exists"

    existing_username = get_user_by_username(db, username)
    if existing_username:
        return None, "Username already exists"

    new_user = User(
        username=username,
        email=email,
        password_hash=hash_password(password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user, None


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user