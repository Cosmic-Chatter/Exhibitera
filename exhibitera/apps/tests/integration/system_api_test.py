import requests
import platform

base_url = "http://localhost:8000"

# Validate that the get plaform details returns a 200 and the right architecture. 
# This is meant as a regression test for some api reorganization

def test_system_get_platform_details():
    response = requests.get(base_url+'/system/getPlatformDetails')
    assert response.status_code == 200
    json = response.json()
    architecture = json.get('architecture')
    actualArchitecture = platform.architecture()[0]
    assert architecture == actualArchitecture

# Validate that screenshot endpoint returns data as an image

def test_system_get_screenshot():
    response = requests.get(base_url+'/system/getScreenshot')
    assert response.status_code == 200
    assert response.content is not None
    assert response.headers.get('content-type') == 'image/jpeg'
