from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Alert_Rules
from app.schemas import AlertRuleCreate, AlertRuleUpdate


def get_rules_for_user(user_id: int, db: Session) -> list[Alert_Rules]:
    return (
        db.query(Alert_Rules)
        .filter(Alert_Rules.user_id == user_id)
        .order_by(Alert_Rules.created_at.desc())
        .all()
    )


def create_rule(user_id: int, data: AlertRuleCreate, db: Session) -> Alert_Rules:
    rule = Alert_Rules(
        user_id=user_id,
        rule_type=data.rule_type,
        repo_filter=data.repo_filter,
        webhook_url=data.webhook_url,
        enabled=data.enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_rule(rule_id: int, user_id: int, data: AlertRuleUpdate, db: Session) -> Alert_Rules:
    rule = _get_owned_rule(rule_id, user_id, db)

    # Use model_fields_set to distinguish "not provided" from "explicitly set to null"
    if "enabled" in data.model_fields_set and data.enabled is not None:
        rule.enabled = data.enabled
    if "repo_filter" in data.model_fields_set:
        rule.repo_filter = data.repo_filter  # null clears back to "all repos"
    if "webhook_url" in data.model_fields_set:
        rule.webhook_url = data.webhook_url

    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(rule_id: int, user_id: int, db: Session) -> None:
    rule = _get_owned_rule(rule_id, user_id, db)
    db.delete(rule)
    db.commit()


def toggle_rule(rule_id: int, user_id: int, db: Session) -> Alert_Rules:
    rule = _get_owned_rule(rule_id, user_id, db)
    rule.enabled = not rule.enabled
    db.commit()
    db.refresh(rule)
    return rule


def _get_owned_rule(rule_id: int, user_id: int, db: Session) -> Alert_Rules:
    rule = db.query(Alert_Rules).filter(Alert_Rules.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    if rule.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorised")
    return rule
