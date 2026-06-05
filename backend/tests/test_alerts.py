from app.alerts import should_alert_on_event


def test_alerts_on_failed_completed_workflow():
    event_data = {
        "status": "completed",
        "conclusion": "failure",
    }

    assert should_alert_on_event("workflow_run", event_data) is True


def test_does_not_alert_on_successful_workflow():
    event_data = {
        "status": "completed",
        "conclusion": "success",
    }

    assert should_alert_on_event("workflow_run", event_data) is False