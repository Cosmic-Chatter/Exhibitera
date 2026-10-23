# Standard imports
import threading
import time

# Exhibitera imports
import exhibitera.hub.config as hub_config


def poll_projectors():
    """Ask each projector to send a status update at an interval.
    """

    for projector in hub_config.projectorList:
        new_thread = threading.Thread(target=projector.update, name=f"PollProjector_{projector.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    hub_config.polling_thread_dict["poll_projectors"] = threading.Timer(5, poll_projectors)
    hub_config.polling_thread_dict["poll_projectors"].daemon = True
    hub_config.polling_thread_dict["poll_projectors"].start()
