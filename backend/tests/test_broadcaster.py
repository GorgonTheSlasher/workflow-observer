import pytest

from app.broadcaster import EventBroadcaster


@pytest.mark.anyio
async def test_subscribers_only_hear_their_own_installations():
    broadcaster = EventBroadcaster()
    mine = broadcaster.subscribe([111])
    theirs = broadcaster.subscribe([222])
    demo_viewer = broadcaster.subscribe([333])

    await broadcaster.publish({"event_type": "push"}, 111)

    assert mine.get_nowait() == {"event_type": "push"}
    assert theirs.empty()
    assert demo_viewer.empty()


@pytest.mark.anyio
async def test_events_without_an_installation_reach_nobody():
    broadcaster = EventBroadcaster()
    q = broadcaster.subscribe([111])

    await broadcaster.publish({"event_type": "push"}, None)

    assert q.empty()


@pytest.mark.anyio
async def test_unsubscribed_queue_gets_nothing():
    broadcaster = EventBroadcaster()
    q = broadcaster.subscribe([111])
    broadcaster.unsubscribe(q)

    await broadcaster.publish({"event_type": "push"}, 111)

    assert q.empty()
