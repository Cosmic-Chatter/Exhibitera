@if [%~1]==[] goto :NoPath

@Xcopy /E /I /q /y ..\..\..\exhibitera %1\exhibitera
copy ..\..\..\Exhibitera_Apps.py %1\.

@REM Leave out the tests, including any copied by older builds
@for %%d in (apps hub common) do @if exist %1\exhibitera\%%d\tests rmdir /S /Q %1\exhibitera\%%d\tests

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END