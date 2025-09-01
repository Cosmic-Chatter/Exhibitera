# Handle migration from past versions of Exhibitera Apps

import os
import re
import shutil

import exhibitera.common.files as ex_files
import exhibitera.common.utilities as ex_utilities
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


# Added in Ex6
def update_infostation_definition_format():
    # Update the format of InfoStation definition files to separate structure and localization

    current_version = ex_files.load_json(ex_files.get_path(["_static", "semantic_version.json"]))
    def_path = ex_files.get_path(["definitions"], user_file=True)
    for file in os.listdir(def_path):
        if not file.lower().endswith("json"):
            continue
        file_path = ex_files.get_path(["definitions", file], user_file=True)
        definition = ex_files.load_json(file_path)
        if definition is None or definition.get("app", "") != "infostation":
            continue
        if not ex_utilities.semantic_version_less_than(definition.get("exhibitera_version", "0.0.0")
                , "6.0.0"):
            continue

        new_def = {
            "app": "infostation",
            "behavior": {
                "attractor": definition.get("attractor", ""),
                "inactivity_timeout": definition.get("inactivity_timeout", "")
            },
            "exhibitera_version": current_version["version"],
            "lastEditedDate": definition.get("lastEditedDate", ""),
            "languages": {},
            "language_order": definition.get("language_order", []),
            "name": definition.get("name", ""),
            "setup": {
                "auto_refresh": definition.get("auto_refresh", True),
                "preview_ratio": definition.get("preview_ratio", "16x9")
            },
            "style": definition.get("style", {}),
            "tabs": {},
            "tab_order": [],
            "uuid": definition.get("uuid", ""),
        }

        if len(new_def["language_order"]) > 0:
            # Use the first language as the default
            default_lang = new_def["language_order"][0]
            new_def["tab_order"] = definition.get("languages", {}).get(default_lang, {}).get("tab_order", [])


            # Cycle through the languages, rebuilding the dicts for each.
            # We will use the default language uuids for each tab
            for lang in new_def["language_order"]:
                lang_def = definition.get("languages", {}).get(lang, {})
                new_def["languages"][lang] = {
                    "code": lang,
                    "display_name": lang_def.get("display_name", ""),
                    "english_name": lang_def.get("english_name", ""),
                    "header": {
                        "text": lang_def.get("header", "")
                    },
                    "tabs": {}
                }

                i = 0
                for uuid in new_def["tab_order"]:
                    # Get the old, language-specific uuid for this tab so we can index tabs
                    # But we will be replacing the definition with the corresponding uuid
                    # from the default language
                    old_tab_order = definition.get("languages", {}).get(lang, {}).get("tab_order", [])
                    if len(old_tab_order) <= i:
                        new_def["languages"][lang]["tabs"][uuid] = {
                            "button_text": "",
                            "text": "",
                            "uuid": uuid}
                        continue

                    old_uuid = old_tab_order[i]
                    tab = definition.get("languages", {}).get(lang, {}).get("tabs", {}).get(old_uuid, {})
                    new_def["tabs"][uuid] = {"type": tab.get("type", "text"), "uuid": uuid}
                    new_def["languages"][lang]["tabs"][uuid] = {
                        "button_text": tab.get("button_text", ""),
                        "text": tab.get("text", ""),
                        "uuid": uuid
                    }
                    i += 1

        # Rename the old file
        backup_path = ex_files.get_path(["definitions", file + '.backup'], user_file=True)
        shutil.copy(file_path, backup_path)

        ex_files.write_json(new_def, file_path)