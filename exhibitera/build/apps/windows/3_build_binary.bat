@if [%~1]==[] goto :NoPath

cd %1
CALL venv\Scripts\activate.bat

pyinstaller --clean --add-data "*.html;." --add-data "api\definitions\definitions.py;api\defintions\." --add-data "api\system\system.py;api\system\." --add-data "css\*;css\." --add-data "css\bootstrap_5_3\*;css\bootstrap_5_3\." --add-data "js\*;js\." --add-data "_fonts\*;_fonts\." --add-data "InfoStation\*;InfoStation\."  --add-data "js\bootstrap_5_3\*;js\bootstrap_5_3\." --add-data "dmx_control\*;dmx_control\." --add-data "media_browser\*;media_browser\." --add-data "media_player\*;media_player\." --add-data "nircmd.exe;." --add-data "other\*;other\." --add-data "*.md;." --add-data "_static\*;_static\." --add-data "_static\icons\*;_static\icons\." --add-data "_static\flags\*;_static\flags\." --add-data "timelapse_viewer\*;timelapse_viewer\." --add-data "timeline_explorer\*;timeline_explorer\." --add-data "voting_kiosk\*;voting_kiosk\." --add-data "word_cloud\*;word_cloud\." --add-data "libusb0.dll;." --runtime-tmpdir .\AppData\ --onefile Exhibitera_Apps.py

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END