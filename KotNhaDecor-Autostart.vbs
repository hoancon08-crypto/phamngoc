Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\PC\.gemini\antigravity\scratch\art-cert-verify"
WshShell.Run "node server.js", 0, False
