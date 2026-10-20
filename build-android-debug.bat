@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\jdk-21\bin\java.exe" set "JAVA_HOME=%~dp0.tools\jdk-21"
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_USER_HOME=%~dp0.android-user-home"
set "GRADLE_USER_HOME=%~dp0.gradle-user-home"
if not exist "node_modules\.bin\cap.cmd" (
  echo Installing the free Android wrapper tools. Internet may be needed on the first run.
  call npm install
  if errorlevel 1 goto :failed
)
call npm run build:web
if errorlevel 1 goto :failed
if not exist "android\gradlew.bat" (
  call npx cap add android
  if errorlevel 1 goto :failed
)
call npx cap sync android
if errorlevel 1 goto :failed
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 (popd & goto :failed)
popd
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "SECRET-SHIFT-debug.apk" >nul
if errorlevel 1 goto :failed
echo.
echo APK ready at:
echo %CD%\SECRET-SHIFT-debug.apk
echo.
echo Connect your Android phone with USB debugging enabled, then run:
echo adb install -r SECRET-SHIFT-debug.apk
pause
exit /b 0
:failed
echo.
echo Android build did not complete. Read the error shown above.
pause
exit /b 1
