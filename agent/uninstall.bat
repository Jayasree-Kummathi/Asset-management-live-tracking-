@echo off
:: ============================================================
:: Mindteck AssetOps Agent - Uninstaller
:: Right-click -> Run as Administrator
:: ============================================================

NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ================================================
echo   Mindteck AssetOps Agent - Uninstalling...
echo  ================================================
echo.

echo [1/4] Stopping agent...
taskkill /F /IM MindteckAssetAgent.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Removing registry startup...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent" /f >nul 2>&1

echo [3/4] Removing scheduled tasks...
schtasks /Delete /TN "MindteckAssetOpsAgent" /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_User" /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_Watchdog" /F >nul 2>&1

echo [4/4] Deleting files...
if exist "C:\MindteckAgent" rd /S /Q "C:\MindteckAgent"

tasklist | findstr /I "MindteckAssetAgent" >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  ================================================
    echo   SUCCESS! Agent fully removed.
    echo  ================================================
) else (
    echo.
    echo  ================================================
    echo   Please restart laptop to fully remove.
    echo  ================================================
)
echo.
pause
