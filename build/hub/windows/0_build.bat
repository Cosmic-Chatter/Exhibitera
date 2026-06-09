@if [%~1]==[] goto :NoPath
@if not exist %1 (
  @echo Creating directory...
  mkdir %1
)

@if not exist %1\venv\Scripts\activate (
  @echo Creating venv
  @where py >nul
  IF ERRORLEVEL 1 (
    @ECHO Command 'py' not available. Make sure 'py' is in the path and pointing at the correct version of Python.
    EXIT /B
  )

  py -m venv %1/venv
)

@CALL 1_copy_files.bat %1
@CALL 2_update_depends.bat %1
@CALL 3_build_binary.bat %1

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END