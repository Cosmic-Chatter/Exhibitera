"""Routing for the Exhibitera protocol, the API that Hub and Apps use to talk to each other.

Unlike the internal API (used by pages served from the same server) and the Core API (for third-party
integrations), the protocol must stay compatible with older versions of the other server. Each protocol
version is a fixed contract, and a new version is only needed when a release makes a breaking change.

Each endpoint is written once and registered under every protocol version that supports it:

    router = ProtocolRouter(["6", "6.1"])

    @router.post("/system/ping")                       # Every version
    async def handle_ping(...): ...

    @router.post("/user/login", until="6")              # The old contract, kept for older clients
    async def log_in_v6(...): ...

    @router.post("/user/login", since="6.1")            # The current contract
    async def log_in(...): ...

Adding a protocol version means adding it to the list; endpoints without a version range carry over.
"""

# Standard modules
from typing import Any, Callable, Iterable

# Third-party modules
from fastapi import APIRouter, FastAPI


def url_prefixes(version: str) -> list[str]:
    """Return the URL prefixes that a server uses for the given protocol version.

    Released 6.0 Hub and Apps call /v6, so version 6 is also served there. Every version is served under
    /external.
    """

    if version == "6":
        return ["/v6", "/external/v6"]
    return [f"/external/v{version}"]


def client_prefix(version: str) -> str:
    """Return the URL prefix to use when calling a server that speaks the given protocol version.

    Released 6.0 servers only serve /v6.
    """

    return "/v6" if version == "6" else f"/external/v{version}"


def protocol_version(api_level: float | int | str) -> str:
    """Convert the api_level a component reports in its pings, such as 6 or 6.1, to a version string."""

    if isinstance(api_level, float) and api_level.is_integer():
        api_level = int(api_level)
    return str(api_level)


def _version_key(version: str) -> tuple[int, ...]:
    """Order versions numerically, so that 6.10 comes after 6.2."""

    return tuple(int(part) for part in version.split("."))


class ProtocolRouter:
    """Register each endpoint under every protocol version that supports it."""

    def __init__(self, versions: Iterable[str], **router_options: Any):
        self.versions: list[str] = sorted(versions, key=_version_key)
        self.routers: dict[str, APIRouter] = {version: APIRouter(**router_options) for version in self.versions}

    def _select(self, since: str | None, until: str | None) -> list[str]:
        for bound in (since, until):
            if bound is not None and bound not in self.versions:
                raise ValueError(f"Unknown protocol version {bound!r}; expected one of {self.versions}")

        selected = [v for v in self.versions
                    if (since is None or _version_key(v) >= _version_key(since))
                    and (until is None or _version_key(v) <= _version_key(until))]
        if len(selected) == 0:
            raise ValueError(f"No protocol versions between {since!r} and {until!r}")
        return selected

    def api_route(self, path: str, *, methods: list[str], since: str | None = None, until: str | None = None,
                  **route_options: Any) -> Callable:
        """Register the decorated endpoint for the versions from `since` to `until` (inclusive).

        Other keyword arguments are passed to FastAPI's APIRouter.add_api_route().
        """

        versions = self._select(since, until)

        def decorator(endpoint: Callable) -> Callable:
            for version in versions:
                self.routers[version].add_api_route(path, endpoint, methods=methods, **route_options)
            return endpoint

        return decorator

    def get(self, path: str, **options: Any) -> Callable:
        return self.api_route(path, methods=["GET"], **options)

    def post(self, path: str, **options: Any) -> Callable:
        return self.api_route(path, methods=["POST"], **options)

    def delete(self, path: str, **options: Any) -> Callable:
        return self.api_route(path, methods=["DELETE"], **options)

    def include_in(self, app: FastAPI, prefixes: Callable[[str], list[str]]) -> None:
        """Add every version's endpoints to the app, under the URL prefixes given for that version."""

        for version, router in self.routers.items():
            for prefix in prefixes(version):
                app.include_router(router, prefix=prefix)
