from app.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = settings.DATABASE_URL

connect_args = {}

# SQLite has threading restrictions. FastAPI uses async. This lets them play together.
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
 
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

# Creates DB session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all DB models
Base = declarative_base()


# Dependency for FastAPI routes
def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()

        