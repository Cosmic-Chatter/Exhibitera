@if [%~1]==[] goto :NoPath

@Xcopy /E /I /q /y ..\..\* %1\*

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END