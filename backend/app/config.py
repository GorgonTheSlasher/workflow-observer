from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET")

settings = Settings()
