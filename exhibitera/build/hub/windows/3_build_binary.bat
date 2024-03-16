@if [%~1]==[] goto :NoPath

cd %1
CALL venv\Scripts\activate.bat

pyinstaller --clean --add-data "*.html;." --add-data "*.js;." --add-data "css\bootstrap_5_3\*;css\bootstrap_5_3\." --add-data "css\*;css\." --add-data "icon\*;icon\." --add-data "*.txt;." --add-data "images\*;images\." --add-data "js\bootstrap_5_3\*;js\bootstrap_5_3\." --add-data "js\*;js\." --add-data "README.md;.\README.md"   --runtime-tmpdir .\AppData\ --onefile control_server.py

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END