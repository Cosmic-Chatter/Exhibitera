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

@if not exist %1\nircmd.exe (
  @echo Exhibitera needs nircmd.exe to operate on Windows. Download from https://www.nirsoft.net/utils/nircmd.html and copy into the target directory.
  EXIT /B
)

@if not exist %1\libusb0.dll (
  @echo Exhibitera needs libusb0.dll to operate on Windows. Download from https://www.dll-files.com/libusb0.dll.html and copy into the target directory.
  EXIT /B
)

@CALL 2_update_depends.bat %1
@CALL 3_build_binary.bat %1

@GOTO :END

@:NoPath
  @ECHO You must pass a path for the build to occur as the first argument
@GOTO :END

@:END