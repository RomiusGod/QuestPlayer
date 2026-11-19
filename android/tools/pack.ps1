param(
    [Parameter(Mandatory=$true)][string]$Base,
    [Parameter(Mandatory=$true)][string]$Out,
    [Parameter(Mandatory=$true)][string]$AssetsRoot
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

Copy-Item -Force $Base $Out
$zip = [System.IO.Compression.ZipFile]::Open($Out, 'Update')
try {
    # classes.dex
    $dex = Join-Path $AssetsRoot 'classes.dex'
    if (Test-Path $dex) {
        $e = $zip.CreateEntry('classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
        $s = $e.Open(); $fs = [System.IO.File]::OpenRead($dex); $fs.CopyTo($s); $fs.Close(); $s.Close()
    }
    # assets/**
    $assets = Join-Path $AssetsRoot 'assets'
    Get-ChildItem -Path $assets -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($AssetsRoot.Length).Replace('\', '/').TrimStart('/')
        $e = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
        $s = $e.Open(); $fs = [System.IO.File]::OpenRead($_.FullName); $fs.CopyTo($s); $fs.Close(); $s.Close()
        Write-Host ("added " + $rel)
    }
} finally {
    $zip.Dispose()
}
