"""Verify the router that registers Exhibitera protocol endpoints under each protocol version."""

# Third-party modules
from fastapi import Depends, FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
import pytest

# Exhibitera modules
from exhibitera.common.protocol_router import ProtocolRouter, client_prefix, protocol_version, url_prefixes


def make_app(router: ProtocolRouter, prefixes=lambda version: ["/v" + version]) -> FastAPI:
    app = FastAPI()
    router.include_in(app, prefixes)
    return app


def routes(app: FastAPI) -> set[tuple[str, str]]:
    return {(method, r.path) for r in app.routes if isinstance(r, APIRoute) for method in r.methods}


def test_endpoint_is_registered_under_every_version():
    router = ProtocolRouter(["6", "6.1", "6.2"])

    @router.get("/system/checkConnection")
    async def check_connection():
        return {"success": True}

    app = make_app(router)

    assert routes(app) == {("GET", "/v6/system/checkConnection"),
                           ("GET", "/v6.1/system/checkConnection"),
                           ("GET", "/v6.2/system/checkConnection")}
    assert TestClient(app).get("/v6.2/system/checkConnection").json() == {"success": True}


def test_breaking_change_keeps_the_old_contract_for_old_versions():
    router = ProtocolRouter(["6", "6.1", "6.2"])

    @router.post("/user/login", until="6")
    async def log_in_v6():
        return {"version": "6"}

    @router.post("/user/login", since="6.1")
    async def log_in():
        return {"version": "current"}

    client = TestClient(make_app(router))

    assert client.post("/v6/user/login").json() == {"version": "6"}
    assert client.post("/v6.1/user/login").json() == {"version": "current"}
    assert client.post("/v6.2/user/login").json() == {"version": "current"}


def test_endpoint_added_in_a_later_version():
    router = ProtocolRouter(["6", "6.1"])

    @router.get("/program/locations", since="6.1")
    async def locations():
        return {"success": True}

    assert routes(make_app(router)) == {("GET", "/v6.1/program/locations")}


def test_version_range():
    router = ProtocolRouter(["6", "6.1", "6.2", "6.3"])

    @router.get("/data", since="6.1", until="6.2")
    async def data():
        return {}

    assert {path for _, path in routes(make_app(router))} == {"/v6.1/data", "/v6.2/data"}


def test_versions_are_ordered_numerically():
    router = ProtocolRouter(["6.10", "6.2", "6"])

    @router.get("/data", since="6.2")
    async def data():
        return {}

    assert router.versions == ["6", "6.2", "6.10"]
    assert {path for _, path in routes(make_app(router))} == {"/v6.2/data", "/v6.10/data"}


def test_one_version_can_be_served_under_several_prefixes():
    router = ProtocolRouter(["6", "6.1"])

    @router.post("/system/ping")
    async def ping():
        return {"success": True}

    # e.g. released Apps 6.0 calls /v6, while newer versions call /external/v6
    app = make_app(router, prefixes=lambda version: ["/v6", "/external/v6"] if version == "6" else ["/external/v" + version])

    assert {path for _, path in routes(app)} == {"/v6/system/ping", "/external/v6/system/ping", "/external/v6.1/system/ping"}


def test_route_options_are_passed_through():
    router = ProtocolRouter(["6"])
    calls = []

    def dependency():
        calls.append("checked")

    @router.delete("/thing/{uuid}", dependencies=[Depends(dependency)], include_in_schema=False)
    async def delete_thing(uuid: str):
        return {"uuid": uuid}

    app = make_app(router)

    assert TestClient(app).delete("/v6/thing/abc").json() == {"uuid": "abc"}
    assert calls == ["checked"]
    route = next(r for r in app.routes if isinstance(r, APIRoute))
    assert route.include_in_schema is False


def test_decorator_returns_the_function_unchanged():
    router = ProtocolRouter(["6"])

    async def handler():
        return {}

    assert router.get("/x")(handler) is handler


@pytest.mark.parametrize("kwargs", [{"since": "7"}, {"until": "5"}])
def test_unknown_version_is_rejected(kwargs):
    router = ProtocolRouter(["6", "6.1"])

    with pytest.raises(ValueError):
        router.get("/x", **kwargs)


def test_empty_version_range_is_rejected():
    router = ProtocolRouter(["6", "6.1"])

    with pytest.raises(ValueError):
        router.get("/x", since="6.1", until="6")


# Which URL prefixes each protocol version uses


def test_released_version_6_keeps_its_original_prefix():
    # Released 6.0 Hub and Apps only know /v6
    assert url_prefixes("6") == ["/v6", "/external/v6"]
    assert client_prefix("6") == "/v6"


@pytest.mark.parametrize("version", ["6.1", "6.2", "7"])
def test_later_versions_use_the_external_prefix(version):
    assert url_prefixes(version) == [f"/external/v{version}"]
    assert client_prefix(version) == f"/external/v{version}"


@pytest.mark.parametrize("api_level, version", [(6, "6"), (6.0, "6"), (6.1, "6.1"), ("6.1", "6.1"), (7, "7")])
def test_protocol_version_from_api_level(api_level, version):
    # Components report their version as a number in their pings
    assert protocol_version(api_level) == version
