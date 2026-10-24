"""HTTP caching for the pages and scripts that Hub and Apps serve."""

# Third-party modules
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Content types that browsers must check for updates before reusing
REVALIDATED_TYPES = ("text/html", "text/javascript", "application/javascript", "text/css")


class RevalidatePagesMiddleware:
    """Tell browsers to check for a newer version of each page, script, and stylesheet before using it.

    Without this, a browser may keep running old scripts after an upgrade, which can call API endpoints
    that no longer exist. Unchanged files get a short "not modified" reply, so this costs little.

    This is plain ASGI middleware, rather than Starlette's BaseHTTPMiddleware, so that streaming
    responses (like Hub's update stream) still notice when a browser disconnects.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_cache_control(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if headers.get("content-type", "").startswith(REVALIDATED_TYPES) and "cache-control" not in headers:
                    headers["cache-control"] = "no-cache"
            await send(message)

        await self.app(scope, receive, send_with_cache_control)
