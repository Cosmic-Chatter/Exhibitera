@if [%~1]==[] goto :NoPath

CALL %1\venv\Scripts\activate.bat

python -m pip install --upgrade pip
python -m pip install --upgrade pyinstaller
python -m pip install --upgrade -r ..\..\..\hub\requirements.txt

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END