@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "RCLONE=%SCRIPT_DIR%rclone-v1.73.5-windows-amd64\rclone.exe"
set "REMOTE=portfolio-bucket:portfolio/"
set "INDEX_LOCAL=%SCRIPT_DIR%index.json"

if not exist "%RCLONE%" (
    echo ERROR: rclone not found at %RCLONE%
    pause
    exit /b 1
)

call :PULL_INDEX
goto MENU

:: ─────────────────────────────────────────────────────────────────
:MENU
cls
echo ================================================
echo   CAD Model Manager
echo ================================================
echo.
call :LIST_MODELS
echo.
echo  [1] Rename a model
echo  [2] Upload a new model
echo  [3] Delete a model
echo  [4] Refresh from bucket
echo  [0] Exit
echo.
set /p CHOICE="Choose an option: "

if "%CHOICE%"=="1" goto RENAME
if "%CHOICE%"=="2" goto UPLOAD
if "%CHOICE%"=="3" goto DELETE
if "%CHOICE%"=="4" call :PULL_INDEX & goto MENU
if "%CHOICE%"=="0" exit /b 0
goto MENU

:: ─────────────────────────────────────────────────────────────────
:LIST_MODELS
powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$i = 1; " ^
    "foreach ($m in $j.models) { " ^
    "    Write-Host ('  [' + $i + '] ' + $m.name + '  (' + $m.file + ')'); " ^
    "    $i++ " ^
    "}"
exit /b 0

:: ─────────────────────────────────────────────────────────────────
:RENAME
cls
echo ================================================
echo   Rename a Model
echo ================================================
echo.
call :LIST_MODELS
echo.
set /p IDX="Enter model number to rename (0 to cancel): "
if "%IDX%"=="0" goto MENU

set /p NEW_NAME="Enter new short name: "
if "%NEW_NAME%"=="" (
    echo Name cannot be empty.
    pause
    goto MENU
)

powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$idx = [int]'%IDX%' - 1; " ^
    "if ($idx -lt 0 -or $idx -ge $j.models.Count) { Write-Host 'Invalid number.'; exit 1 } " ^
    "$j.models[$idx].name = '%NEW_NAME%'; " ^
    "$j | ConvertTo-Json -Depth 10 | Set-Content '%INDEX_LOCAL%'"

if errorlevel 1 (
    echo Failed to update index.json.
    pause
    goto MENU
)

call :PUSH_INDEX
echo Done. Model renamed to "%NEW_NAME%".
pause
goto MENU

:: ─────────────────────────────────────────────────────────────────
:UPLOAD
cls
echo ================================================
echo   Upload a New Model
echo ================================================
echo.
set /p FILE_PATH="Drag and drop the file here (or enter full path): "

:: Strip surrounding quotes if drag-dropped
set FILE_PATH=%FILE_PATH:"=%

if not exist "%FILE_PATH%" (
    echo ERROR: File not found: %FILE_PATH%
    pause
    goto MENU
)

for %%F in ("%FILE_PATH%") do set "FILE_NAME=%%~nxF"

set /p SHORT_NAME="Enter short display name for this model: "
if "%SHORT_NAME%"=="" (
    echo Name cannot be empty.
    pause
    goto MENU
)

echo.
echo Uploading "%FILE_NAME%" to bucket...
"%RCLONE%" copy "%FILE_PATH%" "%REMOTE%" --progress
if errorlevel 1 (
    echo ERROR: Upload failed.
    pause
    goto MENU
)

powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$entry = [PSCustomObject]@{ name = '%SHORT_NAME%'; file = '%FILE_NAME%' }; " ^
    "$j.models += $entry; " ^
    "$j | ConvertTo-Json -Depth 10 | Set-Content '%INDEX_LOCAL%'"

if errorlevel 1 (
    echo ERROR: Failed to update index.json.
    pause
    goto MENU
)

call :PUSH_INDEX
echo Done. "%SHORT_NAME%" uploaded and added to index.
pause
goto MENU

:: ─────────────────────────────────────────────────────────────────
:DELETE
cls
echo ================================================
echo   Delete a Model
echo ================================================
echo.
call :LIST_MODELS
echo.
set /p IDX="Enter model number to delete (0 to cancel): "
if "%IDX%"=="0" goto MENU

:: Get file name before deleting
for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$idx = [int]'%IDX%' - 1; " ^
    "if ($idx -lt 0 -or $idx -ge $j.models.Count) { exit 1 } " ^
    "$j.models[$idx].file"') do set "DEL_FILE=%%A"

if errorlevel 1 (
    echo Invalid number.
    pause
    goto MENU
)

for /f "delims=" %%A in ('powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$j.models[[int]'%IDX%' - 1].name"') do set "DEL_NAME=%%A"

echo.
echo You are about to permanently delete:
echo   Name: %DEL_NAME%
echo   File: %DEL_FILE%
echo.
set /p CONFIRM="Type YES to confirm: "
if /i not "%CONFIRM%"=="YES" (
    echo Cancelled.
    pause
    goto MENU
)

echo Deleting "%DEL_FILE%" from bucket...
"%RCLONE%" deletefile "%REMOTE%%DEL_FILE%"
if errorlevel 1 (
    echo WARNING: Could not delete file from bucket ^(it may not exist^).
)

powershell -NoProfile -Command ^
    "$j = Get-Content '%INDEX_LOCAL%' -Raw | ConvertFrom-Json; " ^
    "$idx = [int]'%IDX%' - 1; " ^
    "$list = [System.Collections.Generic.List[object]]$j.models; " ^
    "$list.RemoveAt($idx); " ^
    "$j.models = $list.ToArray(); " ^
    "$j | ConvertTo-Json -Depth 10 | Set-Content '%INDEX_LOCAL%'"

if errorlevel 1 (
    echo ERROR: Failed to update index.json.
    pause
    goto MENU
)

call :PUSH_INDEX
echo Done. "%DEL_NAME%" removed.
pause
goto MENU

:: ─────────────────────────────────────────────────────────────────
:PULL_INDEX
echo Fetching latest index.json from bucket...
"%RCLONE%" copy "%REMOTE%index.json" "%SCRIPT_DIR%" --progress
if errorlevel 1 (
    echo WARNING: Could not pull index.json from bucket. Using local copy.
)
exit /b 0

:: ─────────────────────────────────────────────────────────────────
:PUSH_INDEX
echo Pushing index.json to bucket...
"%RCLONE%" copyto "%INDEX_LOCAL%" "%REMOTE%index.json" --progress
if errorlevel 1 (
    echo ERROR: Failed to push index.json to bucket^^!
    pause
)
exit /b 0
