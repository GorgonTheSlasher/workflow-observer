from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# SQLite uses /// for relative path
DATABASE_URL = "sqlite:///./workflow_observer.db"

# SQLite has threading restrictions. FastAPI uses async. This lets them play together. 
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
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