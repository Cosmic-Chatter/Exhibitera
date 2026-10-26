"""The Exhibitera protocol: the endpoints that Hub and its web console call on Apps.

Hub may run a different version than Apps, so each protocol version is a fixed contract. Each endpoint
is registered for every protocol version that supports it (see ProtocolRouter). The implementations
live in the internal API, which Apps' own pages also use.
"""

# Third-party modules
from fastapi.responses import Response

# Exhibitera modules
from exhibitera.common.protocol_router import ProtocolRouter
from exhibitera.apps.api.internal.definitions import definitions as definitions_internal
from exhibitera.apps.api.internal.dmx import dmx as dmx_internal
from exhibitera.apps.api.internal.files import files as files_internal
from exhibitera.apps.api.internal.system import system as system_internal

router = ProtocolRouter(["6", "6.1"])


# Definitions

router.get("/definitions")(definitions_internal.get_available_definitions)
router.post("/definitions/write")(definitions_internal.write_definition)
router.get("/definitions/{this_uuid}/load")(definitions_internal.load_definition)
router.get("/definitions/{this_uuid}/thumbnail")(definitions_internal.load_definition_thumbnail)
router.get("/definitions/{this_uuid}/getContentList")(definitions_internal.get_definition_content_list)

# Files

router.get("/files/availableContent")(files_internal.get_available_content)
router.post("/files/retrieve")(files_internal.retrieve_file)

# DMX

router.get("/DMX/scenes")(dmx_internal.get_dmx_scenes)
router.get("/DMX/scene/{uuid_str}/set")(dmx_internal.set_dmx_scene)

# System

router.get("/system/checkConnection")(system_internal.check_connection)
router.get("/system/stats")(system_internal.get_system_stats)
router.post("/system/configuration/update")(system_internal.set_defaults)
router.get("/system/screenshot", responses={200: {"content": {"image/png": {}}}},
           response_class=Response)(system_internal.get_screenshot)
router.get("/system/restart")(system_internal.do_restart)
router.get("/system/shutdown")(system_internal.do_shutdown)
