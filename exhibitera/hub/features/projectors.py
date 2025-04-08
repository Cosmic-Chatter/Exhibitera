# Standard imports
import logging
import threading
import time

# Exhibitera imports
import exhibitera.common.files as ex_files
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


# Set up log file
log_path = ex_files.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.WARNING)
