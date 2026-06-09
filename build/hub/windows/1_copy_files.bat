@if [%~1]==[] goto :NoPath

@Xcopy /E /I /q /y ..\..\..\exhibitera %1\exhibitera
copy ..\..\..\Exhibitera_Hub.py %1\.
goto :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END