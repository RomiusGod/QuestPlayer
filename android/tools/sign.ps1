param(
    [Parameter(Mandatory=$true)][string]$Unsigned,
    [Parameter(Mandatory=$true)][string]$Signed,
    [Parameter(Mandatory=$true)][string]$Keystore,
    [Parameter(Mandatory=$true)][string]$Alias,
    [Parameter(Mandatory=$true)][string]$StorePass
)

$bt = 'C:\QuestPlayerBuild\bt\android-14'
$aligned = [System.IO.Path]::ChangeExtension($Signed, '.aligned.apk')

& "$bt\zipalign.exe" -p -f 4 $Unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

& "$bt\apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias `
    --ks-pass "pass:$StorePass" --key-pass "pass:$StorePass" `
    --out $Signed $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Remove-Item -Force $aligned
Write-Host ("signed: " + $Signed)
