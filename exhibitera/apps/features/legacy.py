# Handle migration from past versions of Exhibitera Apps

import os
import re
import shutil

import exhibitera.common.files as ex_files
import exhibitera.apps.features.files as apps_files

# Added in Ex6
def migrate_definition_thumbnails():
    """Move definition thumbnails to their new directory"""

    # Make the definition subdirectory
    dir_path = ex_files.get_path(["thumbnails", "definitions"], user_file=True)
    if not os.path.exists(dir_path):
        os.mkdir(dir_path)

    thumbs = ex_files.get_directory_contents(['thumbnails'])

    uuid4_pattern = re.compile(
        r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b'
    )

    # Filter and return filenames that contain a UUID4
    uuid_thumbs = [filename for filename in thumbs if uuid4_pattern.search(filename)]

    preview_thumbs = [filename for filename in thumbs if filename.startswith('__preview')]

    def_thumbs = uuid_thumbs + preview_thumbs

    for file in def_thumbs:
        source = ex_files.get_path(["thumbnails", file], user_file=True)
        dest = ex_files.get_path(["thumbnails", "definitions", file], user_file=True)
        shutil.move(source, dest)


# Added in Ex6
def fix_appearance_to_style():
    """Correct an issue from pre-Ex6 in which Word Cloud definitions use 'appearance'
    rather than 'style' as the key for visual options.
    """

    def_path = ex_files.get_path(["definitions"], user_file=True)
    for file in os.listdir(def_path):
        if not file.lower().endswith("json"):
            continue
        file_path = ex_files.get_path(["definitions", file], user_file=True)
        definition = ex_files.load_json(file_path)
        if definition is None:
            continue
        if "appearance" in definition:
            backup_path = ex_files.get_path(["definitions", file + '.backup'], user_file=True)
            shutil.copy(file_path, backup_path)
            definition["style"]= definition.pop("appearance")
            ex_files.write_json(definition, file_path)