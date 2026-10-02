$src = 'C:\Users\PC\.gemini\antigravity\scratch\art-cert-verify'
$dst = 'C:\Users\PC\Downloads\code-du-an'
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$items = Get-ChildItem -Path $src -Exclude 'node_modules', '.git', 'cloudflared.exe', '*.log', '*.vbs'
foreach ($item in $items) {
    Copy-Item -Path $item.FullName -Destination $dst -Recurse -Force
}
Write-Output "Copied to $dst successfully"
