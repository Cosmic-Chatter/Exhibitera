@if [%~1]==[] goto :NoPath

cd %1
CALL venv\Scripts\activate.bat

pyinstaller --clean --add-data "exhibitera\hub\_static\:exhibitera\hub\_static\." --add-data "exhibitera\hub\api\:exhibitera\hub\api\." --add-data "exhibitera\hub\css\:exhibitera\hub\css\." --add-data "exhibitera\hub\features\:exhibitera\hub\features\." --add-data "exhibitera\common\:exhibitera\common\." --add-data "exhibitera\hub\js\:exhibitera\hub\js\." --add-data "exhibitera\hub\*.py:exhibitera\hub\." --add-data "exhibitera\hub\*.js:exhibitera\hub\." --add-data "exhibitera\hub\*.html:exhibitera\hub\." --add-data "exhibitera\hub\*.json:exhibitera\hub\." --add-data "exhibitera\hub\*.txt:exhibitera\hub\." --add-data "exhibitera\hub\*.md:exhibitera\hub\." --icon "exhibitera\hub\_static\icon.ico" --runtime-tmpdir .\AppData\ --onefile Exhibitera_Hub.py

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END