from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.alerts import format_test_alert, send_slack_alert
from app.routers import auth, settings, stream, summary, webhooks
from app.services.auth_services import get_current_user

app = FastAPI(title="GitHub Workflow Observer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://workflow-observer.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(summary.router)
app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(stream.router)


@app.get("/")
def root():
    return {"status": "ok"}


@app.post("/test-alert")
def test_alert(current_user: dict = Depends(get_current_user)):
    send_slack_alert(format_test_alert())
    return {"success": True}
