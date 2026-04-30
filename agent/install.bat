@echo off
:: ============================================================
:: Mindteck AssetOps Agent - One Click Installer v5.3
::
:: SYSTEM task  → registration + software installs + full reporting
:: User task    → idle/active tracking ONLY (no registration)
:: Watchdog     → restarts SYSTEM task every 3 min if crashed
:: Self-Heal    → SYSTEM auto-fixes user task every 3 min at runtime
:: SILENT       → all tasks run hidden, no console window shown
::
:: Right-click → Run as Administrator
:: ============================================================

NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ================================================
echo   Mindteck AssetOps Agent - Installing v5.3
echo   SYSTEM task  : Register + Software push + Reporting
echo   User task    : Activity + idle tracking ONLY
echo   Self-Heal    : SYSTEM fixes user task automatically
echo   Silent Mode  : No console window shown to users
echo  ================================================
echo.

:: ── Step 1: Create install folder ────────────────────────────
echo [1/10] Creating install folder...
if not exist "C:\MindteckAgent" mkdir "C:\MindteckAgent"
if %errorLevel% neq 0 (
    echo ERROR: Cannot create C:\MindteckAgent
    pause & exit /b 1
)

:: ── Step 2: Copy agent EXE ───────────────────────────────────
echo [2/10] Copying agent...
if not exist "%~dp0MindteckAssetAgent.exe" (
    echo ERROR: MindteckAssetAgent.exe not found next to install.bat
    echo        Make sure both files are in the same folder.
    pause & exit /b 1
)
copy /Y "%~dp0MindteckAssetAgent.exe" "C:\MindteckAgent\MindteckAssetAgent.exe" >nul
if %errorLevel% neq 0 (
    echo ERROR: Failed to copy agent EXE
    pause & exit /b 1
)
echo        Copied to C:\MindteckAgent\MindteckAssetAgent.exe

:: ── Step 3: Kill existing instances and clean up ALL legacy startup entries ──
echo [3/10] Stopping old instances and cleaning legacy entries...
taskkill /F /IM MindteckAssetAgent.exe >nul 2>&1
taskkill /F /IM wscript.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Remove old scheduled tasks
schtasks /Delete /TN "MindteckAssetOpsAgent"          /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_User"     /F >nul 2>&1
schtasks /Delete /TN "MindteckAssetOpsAgent_Watchdog" /F >nul 2>&1

:: Remove ALL registry Run keys
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent"      /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent"      /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAssetAgent" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAssetAgent" /f >nul 2>&1

:: Remove old VBS/lock files
del /F /Q "C:\MindteckAgent\start.vbs"       >nul 2>&1
del /F /Q "C:\MindteckAgent\silent.vbs"      >nul 2>&1
del /F /Q "C:\MindteckAgent\silent_user.vbs" >nul 2>&1
del /F /Q "%TEMP%\start.vbs"                 >nul 2>&1
del /F /Q "%SystemRoot%\Temp\start.vbs"      >nul 2>&1
del /F /Q "%TEMP%\mindteck-agent*.lock"      >nul 2>&1
del /F /Q "%SystemRoot%\Temp\mindteck-*.lock" >nul 2>&1

echo        Legacy entries cleaned OK

:: ── Step 4: Create SILENT VBScript launchers ─────────────────
echo [4/10] Creating silent launchers (no console window)...

:: SYSTEM silent launcher
(
    echo Set oShell = CreateObject^("WScript.Shell"^)
    echo oShell.Run """C:\MindteckAgent\MindteckAssetAgent.exe""", 0, False
) > "C:\MindteckAgent\silent.vbs"

:: User silent launcher (with --user-session flag)
(
    echo Set oShell = CreateObject^("WScript.Shell"^)
    echo oShell.Run """C:\MindteckAgent\MindteckAssetAgent.exe"" --user-session", 0, False
) > "C:\MindteckAgent\silent_user.vbs"

:: Watchdog silent launcher
(
    echo Set oShell = CreateObject^("WScript.Shell"^)
    echo Dim proc
    echo proc = oShell.Run^("powershell -NonInteractive -WindowStyle Hidden -Command ""if(-not(Get-Process -Name MindteckAssetAgent -EA SilentlyContinue)){Start-Process 'C:\MindteckAgent\MindteckAssetAgent.exe' -WindowStyle Hidden}""", 0, True^)
) > "C:\MindteckAgent\silent_watchdog.vbs"

if exist "C:\MindteckAgent\silent.vbs" (
    echo        Silent launchers created OK
) else (
    echo ERROR: Failed to create silent launchers
    pause & exit /b 1
)

:: ── Step 5: SYSTEM boot task — runs via silent.vbs (no window) ──
echo [5/10] Installing SYSTEM boot task (silent)...
powershell -NonInteractive -NoProfile -Command ^
  "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '//B //NoLogo C:\MindteckAgent\silent.vbs';" ^
  "$t = New-ScheduledTaskTrigger -AtStartup; $t.Delay = 'PT30S';" ^
  "$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
  "$p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest -LogonType ServiceAccount;" ^
  "Register-ScheduledTask -TaskName 'MindteckAssetOpsAgent' -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null"

if %errorLevel% neq 0 (
    echo ERROR: Failed to create SYSTEM boot task
    echo        Make sure you right-clicked and chose "Run as Administrator"
    pause & exit /b 1
)
echo        SYSTEM task created OK (silent, no window)

:: ── Step 6: Detect the REAL logged-in user ───────────────────
echo [6/10] Detecting currently logged-in user...
for /f "tokens=1 skip=1" %%U in ('query user 2^>nul') do (
    set REAL_USER=%%U
    goto :got_user
)
for /f "tokens=2 delims=\" %%U in ('powershell -NoProfile -Command "(Get-WmiObject Win32_ComputerSystem).UserName" 2^>nul') do (
    set REAL_USER=%%U
    goto :got_user
)
set REAL_USER=%USERNAME%

:got_user
set REAL_USER=%REAL_USER:>=_%
for /f "tokens=1" %%U in ("%REAL_USER%") do set REAL_USER=%%U
echo        Detected user: %REAL_USER%

:: ── Step 7: User logon task — runs via silent_user.vbs (no window) ──
echo [7/10] Installing User logon task (silent, all users)...
powershell -NonInteractive -NoProfile -Command ^
  "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '//B //NoLogo C:\MindteckAgent\silent_user.vbs';" ^
  "$t = New-ScheduledTaskTrigger -AtLogOn; $t.Delay = 'PT15S';" ^
  "$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
  "$p = New-ScheduledTaskPrincipal -GroupId 'BUILTIN\Users' -RunLevel Highest;" ^
  "Register-ScheduledTask -TaskName 'MindteckAssetOpsAgent_User' -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null"

if %errorLevel% neq 0 (
    echo        Group-based task failed, trying current user fallback...
    powershell -NonInteractive -NoProfile -Command ^
      "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '//B //NoLogo C:\MindteckAgent\silent_user.vbs';" ^
      "$t = New-ScheduledTaskTrigger -AtLogOn; $t.Delay = 'PT15S';" ^
      "$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
      "$p = New-ScheduledTaskPrincipal -UserId '%REAL_USER%' -RunLevel Highest -LogonType Interactive;" ^
      "Register-ScheduledTask -TaskName 'MindteckAssetOpsAgent_User' -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null"
    if %errorLevel% neq 0 (
        echo WARNING: User logon task failed - self-heal in agent will fix this automatically
    ) else (
        echo        User task created for %REAL_USER% (silent, self-heal will update on user switch)
    )
) else (
    echo        User task created for ALL users (silent, no window)
)

:: ── Step 8: Watchdog task — runs via silent_watchdog.vbs ─────
echo [8/10] Installing watchdog task (silent)...
powershell -NonInteractive -NoProfile -Command ^
  "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '//B //NoLogo C:\MindteckAgent\silent_watchdog.vbs';" ^
  "$t = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 3) -Once -At (Get-Date);" ^
  "$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries;" ^
  "$p = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest -LogonType ServiceAccount;" ^
  "Register-ScheduledTask -TaskName 'MindteckAssetOpsAgent_Watchdog' -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null"

if %errorLevel% neq 0 (
    echo WARNING: Watchdog task failed - non-critical, continuing...
) else (
    echo        Watchdog task created OK (silent)
)

:: ── Step 9: Verify tasks and registry cleanliness ────────────
echo [9/10] Verifying installation...
schtasks /Query /TN "MindteckAssetOpsAgent" /FO LIST >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: SYSTEM task not found after creation!
    pause & exit /b 1
)

:: Final registry sweep
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent"      /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAgent"      /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAssetAgent" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "MindteckAssetAgent" /f >nul 2>&1
echo        Registry clean OK

:: ── Step 10: Start both tasks now (silently) ─────────────────
echo [10/10] Starting agent tasks silently...
schtasks /Run /TN "MindteckAssetOpsAgent"      >nul 2>&1
timeout /t 4 /nobreak >nul
schtasks /Run /TN "MindteckAssetOpsAgent_User" >nul 2>&1
timeout /t 4 /nobreak >nul

tasklist | findstr /I "MindteckAssetAgent" >nul 2>&1
if %errorLevel% equ 0 (
    echo.
    echo  ================================================
    echo   SUCCESS! Agent is running silently.
    echo.
    echo   SYSTEM task : Registration + Software + Reporting
    echo   User task   : Activity tracking (any user logon)
    echo   Watchdog    : Auto-restart every 3 min
    echo   Self-Heal   : Agent fixes user task every 3 min
    echo   Silent Mode : NO console window shown to users
    echo.
    echo   ONE entry per machine in AssetOps dashboard.
    echo   Working hours update every minute from User task.
    echo.
    echo   Logs (check via admin if needed):
    echo   %TEMP%\mindteck-agent.log       (SYSTEM)
    echo   %TEMP%\mindteck-agent-user.log  (User)
    echo  ================================================
) else (
    echo.
    echo  ================================================
    echo   Installed - Agent will start silently on next boot.
    echo.
    echo   If it doesn't appear in dashboard within 5 min:
    echo   1. Run: schtasks /Run /TN MindteckAssetOpsAgent
    echo   2. Check log: %TEMP%\mindteck-agent.log
    echo  ================================================
)

echo.
echo  Task status:
schtasks /Query /TN "MindteckAssetOpsAgent"          /FO TABLE 2>nul | findstr /V "^$"
schtasks /Query /TN "MindteckAssetOpsAgent_User"     /FO TABLE 2>nul | findstr /V "^$"
schtasks /Query /TN "MindteckAssetOpsAgent_Watchdog" /FO TABLE 2>nul | findstr /V "^$"
echo.
pause

