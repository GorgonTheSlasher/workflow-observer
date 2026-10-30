from app.cache import AnalyticsCache


def test_returns_cached_value_until_ttl(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr("app.cache.time.monotonic", lambda: now[0])
    cache = AnalyticsCache(ttl_seconds=60)

    cache.set(("dora", (1,), ()), {"value": 1})
    now[0] += 59
    assert cache.get(("dora", (1,), ())) == {"value": 1}
    now[0] += 2
    assert cache.get(("dora", (1,), ())) is None


def test_invalidate_only_clears_that_installation():
    cache = AnalyticsCache()
    cache.set(("dora", (1,), ()), "tenant 1")
    cache.set(("dora", (1, 2), ()), "tenants 1 and 2")
    cache.set(("dora", (3,), ()), "tenant 3")

    cache.invalidate_installation(1)

    assert cache.get(("dora", (1,), ())) is None
    assert cache.get(("dora", (1, 2), ())) is None
    assert cache.get(("dora", (3,), ())) == "tenant 3"


def test_evicts_least_recently_used_past_max_entries():
    cache = AnalyticsCache(max_entries=2)
    cache.set(("a", (), ()), 1)
    cache.set(("b", (), ()), 2)
    cache.get(("a", (), ()))  # a is now more recent than b
    cache.set(("c", (), ()), 3)

    assert cache.get(("b", (), ())) is None
    assert cache.get(("a", (), ())) == 1
    assert cache.get(("c", (), ())) == 3
