import requests
import json
from os import listdir

baseUrl = "http://localhost:8000/definitions"

definitionFilePath = ""
# A larger test that will list definitions,
# Attempt to create a definition,
# Attempt to read the definition
# Attempt to delete the definition
def test_definition_api_flow():
    # Create a dummy entry
    payload = json.dumps({
        "definition":  {"app": "other",
        "exhibitera_version": 5.2,
        "lastEditedDate": "2024-09-08T16:39:03.346Z",
        "name": "IntegrationTesting",
        "path": "",
        "properties": {}}
        })
    createRequest = requests.post(baseUrl+'/write',data=payload)
    assert createRequest.status_code == 200
    uuid = createRequest.json().get("uuid")
    files = listdir('./definitions')
    assert uuid+'.json' in files

    # Validate the dummy entry is availabe in the getAvailable
    getAvailable = requests.get(baseUrl+"/other/getAvailable")
    assert getAvailable.status_code == 200
    availableJson = getAvailable.json().get("definitions").get(uuid)
    assert availableJson is not None
    
    # Load definition
    loadDefinition = requests.get(baseUrl+"/"+uuid+"/load")
    assert loadDefinition.status_code == 200
    assert loadDefinition.json().get("success") is True
    loadedDefinitionUuid = loadDefinition.json().get("definition").get("uuid")
    assert loadedDefinitionUuid == uuid
    
    # Delete loaded definition 
    deleteDefinition = requests.get(baseUrl + "/"+uuid+"/delete")
    assert deleteDefinition.status_code == 200
    files = listdir('./definitions')
    assert uuid+'.json' not in files

def test_load_definition_fails_with_bad_uuid():
    loadDefinition = requests.get(baseUrl+"/cats/load")
    assert loadDefinition.status_code == 200
    assert loadDefinition.json().get("success") is False