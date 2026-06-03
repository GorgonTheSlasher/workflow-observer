from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    def __init__(self):
        self.GITHUB_WEBHOOK_SECRET = os.getenv(
            "GITHUB_WEBHOOK_SECRET"
        ) # This is the secret from the github repo. Can be found in .env

        self.SLACK_WEBHOOK_URL = os.getenv(
            "SLACK_WEBHOOK_URL"
        ) # This is the url for the slack webhook. Can be found in .env

        self.DATABASE_URL = os.getenv(
            "DATABASE_URL, sqlite:///./workflow_observer.db"
        ) # This is the url for the database. Can be found in .env

settings = Settings()
