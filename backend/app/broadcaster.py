import asyncio


class EventBroadcaster:
    '''Fans new-event notices out to connected dashboards. Each subscriber registers the
    installations it can see and only hears about events from those, so one tenant's
    activity doesn't make every other tenant's dashboard refetch.

    In memory, so the app must run as a single process.'''

    def __init__(self):
        self._subscribers: dict[asyncio.Queue, frozenset[int]] = {}

    def subscribe(self, installation_ids: list[int]) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=20)
        self._subscribers[q] = frozenset(installation_ids)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.pop(q, None)

    async def publish(self, data: dict, installation_id: int | None) -> None:
        # Events without an installation (repo-level webhooks) belong to no tenant
        if installation_id is None:
            return
        for q, installation_ids in list(self._subscribers.items()):
            if installation_id not in installation_ids:
                continue
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                pass  # slow client, skip rather than block


broadcaster = EventBroadcaster()
