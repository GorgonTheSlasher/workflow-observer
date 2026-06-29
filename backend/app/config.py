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
            "DATABASE_URL",
            "sqlite:///./workflow_observer.db"
        ) # This is the url for the database. Can be found in .env

        self.JWT_SECRET = os.getenv(
            "JWT_SECRET"
        ) # This is the JWT token. Can be found in .env

        self.GITHUB_OAUTH_CLIENT_ID = os.getenv(
            "GITHUB_OAUTH_CLIENT_ID"
        ) # Client ID from the GitHub OAuth App. Can be found in .env

        self.GITHUB_OAUTH_CLIENT_SECRET = os.getenv(
            "GITHUB_OAUTH_CLIENT_SECRET"
        ) # Client secret from the GitHub OAuth App. Can be found in .env

        self.GITHUB_OAUTH_REDIRECT_URI = os.getenv(
            "GITHUB_OAUTH_REDIRECT_URI"
        ) # Must match the callback URL configured on the GitHub OAuth App. Can be found in .env

        self.FRONTEND_BASE_URL = os.getenv(
            "FRONTEND_BASE_URL",
            "http://localhost:5173"
        ) # Where the GitHub OAuth callback redirects back to after issuing a token. Can be found in .env

        self.GITHUB_APP_ID = os.getenv(
            "GITHUB_APP_ID"
        ) # ID for github app. Can be found in .env

        self.GITHUB_APP_WEBHOOK_SECRET = os.getenv(
            "GITHUB_APP_WEBHOOK_SECRET"
        ) # Webhook secret for github app. Can be found in .env

        self.GITHUB_APP_PRIVATE_KEY = os.getenv(
            "GITHUB_APP_PRIVATE_KEY"
        ) # Key for accessing github app. Can be found in .env

        self.GITHUB_APP_CLIENT_ID = os.getenv(
            "GITHUB_APP_CLIENT_ID"
        )

        self.GITHUB_APP_CLIENT_SECRET = os.getenv(
            "GITHUB_APP_CLIENT_SECRET"
        )

        self.GITHUB_APP_REDIRECT_URI = os.getenv(
            "GITHUB_APP_REDIRECT_URI"
        )

settings = Settings()
