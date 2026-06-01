from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET") # This is the secret from the github repo. Can be found in .env
    SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL") # This is the url for the slack webhook. Can be found in .env

settings = Settings()
