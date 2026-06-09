"""Communicate with projectors using PJLink commands"""

# Non-standard imports
import pypjlink


def pjlink_connect(ip: str, password: str = None, timeout: float = 2) -> pypjlink.projector.Projector:
    """Connect to a PJLink projector using pypjlink"""

    projector = pypjlink.Projector.from_address(ip, timeout=timeout)
    projector.authenticate(password=password)

    return projector


def pjlink_send_command(connection: pypjlink.projector.Projector, command: str) -> str | None:
    """Send a command using the PJLink protocol"""

    result = None
    try:
        if command == "error_status":
            result = connection.get_errors()
        elif command == "get_model":
            result = connection.get_manufacturer() + " " + connection.get_product_name()
        elif command == "get_mute":
            result = connection.get_mute()
        elif command == "lamp_status":
            result = connection.get_lamps()
        elif command == "power_off":
            connection.set_power("off")
            result = "off"
        elif command == "power_on":
            connection.set_power("on")
            result = "on"
        elif command == "power_state":
            result = connection.get_power()
        elif command == "get_input":
            result = connection.get_input()
        elif command == "get_inputs":
            result = connection.get_inputs()
        else:
            print(f"Command alias {command} not found for PJLink")
    except pypjlink.projector.ProjectorError as e:
        print("Error:", e.args)
    except IndexError:
        print("Error sending request: has the connection expired?")
    return result
