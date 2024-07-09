# Standard imports
import logging
import threading
import time

# Exhibitera imports
import config
import exhibitera_tools as c_tools
import exhibitera_exhibit as c_exhibit


def poll_projectors():
    """Ask each projector to send a status update at an interval.
    """

    for projector in config.projectorList:
        new_thread = threading.Thread(target=projector.update, name=f"PollProjector_{projector.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    config.polling_thread_dict["poll_projectors"] = threading.Timer(5, poll_projectors)
    config.polling_thread_dict["poll_projectors"].daemon = True
    config.polling_thread_dict["poll_projectors"].start()


# Set up log file
log_path = c_tools.get_path(["hub.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
