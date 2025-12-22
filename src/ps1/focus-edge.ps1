param(
    [Parameter(Mandatory = $true)]
    [string]$EdgeTitle
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
}
"@

function Find-EdgeWindow([bool]$AllowMinimized) {
    Get-Process msedge -ErrorAction SilentlyContinue |
    Where-Object {
        $_.MainWindowTitle -and
        $_.MainWindowTitle -like "*$EdgeTitle*" -and
        ($AllowMinimized -or $_.MainWindowHandle -ne 0)
    } |
    Select-Object -First 1
}

$proc = Find-EdgeWindow $false
if (-not $proc) { $proc = Find-EdgeWindow $true }

if (-not $proc) {
    Write-Error "No edge window found"
    exit 1
}

$handle = $proc.MainWindowHandle

if ([Win]::IsIconic($handle)) {
    [Win]::ShowWindow($handle, 9) # SW_RESTORE only when minimized
}

[Win]::SetForegroundWindow($handle)

