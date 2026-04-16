@echo off
:: ============================================================
:: Mindteck AssetOps Agent - One Click Installer v2.0
:: Right-click -> Run as Administrator
:: ============================================================
NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
echo.
echo  ================================================
echo   Mindteck AssetOps Agent - Installing...
echo  ================================================
echo.
echo [1/6] Creating install folder...
if not exist "C:\MindteckAgent" mkdir "C:\MindteckAgent"
echo [2/6] Copying agent...
copy /Y "%~dp0MindteckAssetAgent.exe" "C:\MindteckAgent\MindteckAssetAgent.exe" >nul
if %errorLevel% neq 0 (
    echo ERROR: MindteckAssetAgent.exe not found next to install.bat
    pause
    exit /b 1
)
echo [3/6] Creating silent launcher...
(
    echo Set o = CreateObject("WScript.Shell"^)
    echo o.Run "C:\MindteckAgent\MindteckAssetAgent.exe", 0, False
) > "C:\MindteckAgent\start.vbs"
echo [4/6] Adding to startup registry...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent" /t REG_SZ /d "wscript.exe \"C:\MindteckAgent\start.vbs\"" /f >nul
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent" /t REG_SZ /d "wscript.exe \"C:\MindteckAgent\start.vbs\"" /f >nul 2>&1
echo [5/6] Removing old tasks...
schtasks /Delete /TN "MindteckAssetOpsAgent" /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_User" /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_Watchdog" /F >nul 2>&1
echo [6/6] Starting agent...
taskkill /F /IM MindteckAssetAgent.exe >nul 2>&1
timeout /t 2 /nobreak >nul
wscript.exe "C:\MindteckAgent\start.vbs"
timeout /t 5 /nobreak >nul
tasklist | findstr /I "MindteckAssetAgent" >nul 2>&1
if %errorLevel% equ 0 (
    echo.
    echo  ================================================
    echo   SUCCESS! Agent is running.
    echo   Laptop will appear in AssetOps dashboard
    echo   Auto-starts on every login automatically
    echo  ================================================
) else (
    echo.
    echo  ================================================
    echo   Installed! Will auto-start on next login.
    echo  ================================================
)
echo.
pause
