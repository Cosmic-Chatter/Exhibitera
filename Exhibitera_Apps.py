import exhibitera.common.config as ex_config

# Must be set before importing Apps, as its modules resolve user file paths at import time
ex_config.user_data_folder_name = "Exhibitera Apps"

from exhibitera.apps import Apps

if __name__ == '__main__':
    Apps.run()
