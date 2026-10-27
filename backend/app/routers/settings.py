from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AlertRuleCreate, AlertRuleResponse, AlertRuleUpdate
from app.services.alert_rule_services import (
    create_rule,
    delete_rule,
    get_rules_for_user,
    toggle_rule,
    update_rule,
)
from app.services.auth_services import get_current_non_demo_user, get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/alert-rules", response_model=list[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_rules_for_user(current_user["id"], db)


@router.post("/alert-rules", response_model=AlertRuleResponse, status_code=201)
def create_alert_rule(
    body: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_non_demo_user),
):
    return create_rule(current_user["id"], body, db)


@router.patch("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    body: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_non_demo_user),
):
    return update_rule(rule_id, current_user["id"], body, db)


@router.patch("/alert-rules/{rule_id}/toggle", response_model=AlertRuleResponse)
def toggle_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_non_demo_user),
):
    return toggle_rule(rule_id, current_user["id"], db)


@router.delete("/alert-rules/{rule_id}", status_code=204)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_non_demo_user),
):
    delete_rule(rule_id, current_user["id"], db)
