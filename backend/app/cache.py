import functools
import threading
import time
from collections import OrderedDict

from app.services.installation_services import get_user_installation_ids

DEFAULT_TTL_SECONDS = 60
MAX_ENTRIES = 512

# Route params that identify who is asking rather than what is asked for
_REQUEST_CONTEXT_PARAMS = {"db", "current_user"}


class AnalyticsCache:
    '''Short-lived in-memory cache for dashboard aggregates.

    Every chart is recomputed from raw events on each request, which is slow on a small
    instance, and a refresh doesn't cancel the requests already running. Results are keyed
    by tenant (installation ids) and query params, so users sharing a tenant, like every
    demo visitor, share entries. New webhook events invalidate their tenant's entries, so
    live updates are never served stale.

    In-memory is fine because the app runs as a single process (the SSE broadcaster needs
    that too). With multiple workers this would need to move to something shared, like Redis.'''

    def __init__(self, ttl_seconds: float = DEFAULT_TTL_SECONDS, max_entries: int = MAX_ENTRIES):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._entries: OrderedDict[tuple, tuple[float, object]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: tuple):
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at < time.monotonic():
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return value

    def set(self, key: tuple, value) -> None:
        with self._lock:
            self._entries[key] = (time.monotonic() + self.ttl_seconds, value)
            self._entries.move_to_end(key)
            while len(self._entries) > self.max_entries:
                self._entries.popitem(last=False)

    def invalidate_installation(self, installation_id: int | None) -> None:
        if installation_id is None:
            return
        with self._lock:
            for key in [k for k in self._entries if installation_id in k[1]]:
                del self._entries[key]

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


analytics_cache = AnalyticsCache()


def cached_for_tenant(route):
    '''Caches a sync route's return value per tenant and query params. The route must take
    `db` and `current_user` params; functools.wraps keeps its signature visible to FastAPI.
    Only for routes returning plain data (dicts, lists), never ORM objects tied to a session.'''

    @functools.wraps(route)
    def wrapper(**kwargs):
        installation_ids = get_user_installation_ids(kwargs["current_user"]["id"], kwargs["db"])
        params = tuple(sorted((k, v) for k, v in kwargs.items() if k not in _REQUEST_CONTEXT_PARAMS))
        key = (route.__name__, tuple(sorted(installation_ids)), params)

        value = analytics_cache.get(key)
        if value is None:
            value = route(**kwargs)
            analytics_cache.set(key, value)
        return value

    return wrapper
