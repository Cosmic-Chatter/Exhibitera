"""Verify that Hub can check whether a device is on when Linux won't let it ping devices itself.

Hub pings without special permissions. Linux only allows that when its net.ipv4.ping_group_range setting includes
Hub's user, and a container or service restriction can prevent it too. Linux's own ping command is always allowed to
ping, so Hub uses it instead and only warns when it can't. Windows needs administrator rights either way.
"""

# Standard modules
import subprocess

# Third-party modules
import icmplib
import pytest

# Exhibitera modules
import exhibitera.hub.config as hub_config
import exhibitera.hub.features.components as hub_components

LINUX_REPLY = """PING 10.0.0.5 (10.0.0.5) 56(84) bytes of data.
64 bytes from 10.0.0.5: icmp_seq=1 ttl=64 time=0.412 ms

--- 10.0.0.5 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.412/0.412/0.412/0.000 ms
"""


@pytest.fixture
def refused(monkeypatch):
    """Make the ping library refused, as on a computer that doesn't allow unprivileged pings, and record the
    system pings Hub runs. Set `reply` to the system ping's result."""

    monkeypatch.setattr(hub_config, "notifications", {})
    monkeypatch.setattr(hub_components, "_use_system_ping", False, raising=False)

    library_calls = []

    def library_ping(*args, **kwargs):
        library_calls.append(args[0])
        raise icmplib.exceptions.SocketPermissionError(False)

    monkeypatch.setattr(hub_components.icmplib, "ping", library_ping)

    state = {"reply": subprocess.CompletedProcess([], 0, LINUX_REPLY, ""), "commands": [], "library": library_calls}

    def run(command, **kwargs):
        state["commands"].append(command)
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return state["reply"]

    monkeypatch.setattr(hub_components.subprocess, "run", run)
    return state


def test_linux_uses_its_ping_command(refused, monkeypatch):
    monkeypatch.setattr(hub_components.sys, "platform", "linux")

    assert hub_components.ip_address_alive("10.0.0.5") == (True, 0.412)
    assert refused["commands"][0][:2] == ["ping", "-c"]
    assert refused["commands"][0][-1] == "10.0.0.5"
    assert "wake_on_lan_privilege" not in hub_config.notifications


def test_a_device_that_doesnt_reply_is_off(refused, monkeypatch):
    monkeypatch.setattr(hub_components.sys, "platform", "linux")
    refused["reply"] = subprocess.CompletedProcess([], 1, "1 packets transmitted, 0 received", "")

    assert hub_components.ip_address_alive("10.0.0.5") == (False, None)
    assert "wake_on_lan_privilege" not in hub_config.notifications


def test_once_refused_hub_goes_straight_to_the_ping_command(refused, monkeypatch):
    # Otherwise every check would first fail with the library
    monkeypatch.setattr(hub_components.sys, "platform", "linux")

    hub_components.ip_address_alive("10.0.0.5")
    hub_components.ip_address_alive("10.0.0.6")

    assert refused["library"] == ["10.0.0.5"]
    assert [command[-1] for command in refused["commands"]] == ["10.0.0.5", "10.0.0.6"]


@pytest.mark.parametrize("reply", [FileNotFoundError("ping"),
                                   subprocess.CompletedProcess([], 2, "", "ping: socket: Operation not permitted")])
def test_hub_warns_when_the_ping_command_cant_be_used_either(refused, monkeypatch, reply):
    monkeypatch.setattr(hub_components.sys, "platform", "linux")
    refused["reply"] = reply

    assert hub_components.ip_address_alive("10.0.0.5") == (False, None)
    assert hub_config.notifications.get("wake_on_lan_privilege") is True


def test_a_slow_ping_command_counts_as_off(refused, monkeypatch):
    monkeypatch.setattr(hub_components.sys, "platform", "linux")
    refused["reply"] = subprocess.TimeoutExpired("ping", 3)

    assert hub_components.ip_address_alive("10.0.0.5") == (False, None)
    assert "wake_on_lan_privilege" not in hub_config.notifications


def test_windows_still_needs_administrator_rights(refused, monkeypatch):
    monkeypatch.setattr(hub_components.sys, "platform", "win32")

    assert hub_components.ip_address_alive("10.0.0.5") == (False, None)
    assert refused["commands"] == []
    assert hub_config.notifications.get("wake_on_lan_privilege") is True
