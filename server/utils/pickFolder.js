// Open a native folder picker (Windows only — uses System.Windows.Forms.FolderBrowserDialog
// via PowerShell). Resolves to the selected absolute path, or null if cancelled.

import { execFile } from 'node:child_process';

export default function pickFolder(initialDir) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('Native folder picker is only available on Windows. Paste a path manually.'));
    }
    const script = `
      Add-Type -AssemblyName System.Windows.Forms | Out-Null
      $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
      $dlg.Description = 'Select a git repository folder'
      $dlg.ShowNewFolderButton = $false
      ${initialDir ? `$dlg.SelectedPath = '${initialDir.replace(/'/g, "''")}'` : ''}
      $dlg.RootFolder = [System.Environment+SpecialFolder]::MyComputer
      $owner = New-Object System.Windows.Forms.Form
      $owner.TopMost = $true
      $owner.StartPosition = 'CenterScreen'
      $owner.Size = New-Object System.Drawing.Size(0,0)
      $owner.ShowInTaskbar = $false
      $owner.Show()
      $owner.Hide()
      $result = $dlg.ShowDialog($owner)
      $owner.Dispose()
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath }
    `;
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const picked = stdout.trim();
      resolve(picked || null);
    });
  });
}
