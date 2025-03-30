# Handle migration from past versions of Exhibitera Apps

import os
import re
import shutil

import helper_files

def migrate_definition_thumbnails():
    """Move definition thumbnails to their new directory"""

    # Make the definition subdirectory
    dir_path = helper_files.get_path(["thumbnails", "definitions"], user_file=True)
    if not os.path.exists(dir_path):
        os.mkdir(dir_path)

    thumbs = helper_files.get_directory_contents(['thumbnails'])

    uuid4_pattern = re.compile(
        r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b'
    )

    # Filter and return filenames that contain a UUID4
    uuid_thumbs = [filename for filename in thumbs if uuid4_pattern.search(filename)]

    preview_thumbs = [filename for filename in thumbs if filename.startswith('__preview')]

    def_thumbs = uuid_thumbs + preview_thumbs

    for file in def_thumbs:
        source = helper_files.get_path(["thumbnails", file], user_file=True)
        dest = helper_files.get_path(["thumbnails", "definitions", file], user_file=True)
        shutil.move(source, dest)
