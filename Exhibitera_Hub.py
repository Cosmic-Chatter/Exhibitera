import exhibitera.common.config as ex_config

# Must be set before importing Hub, as its modules resolve user file paths at import time
ex_config.user_data_folder_name = "Exhibitera Hub"

from exhibitera.hub import Hub

if __name__ == '__main__':
    Hub.run()
