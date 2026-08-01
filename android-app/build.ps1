$ErrorActionPreference = "Stop"

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$bt = "$sdk\build-tools\36.1.0"
$plat = "$sdk\platforms\android-36\android.jar"
$proj = $PSScriptRoot
$build = "$proj\build"

# Clean
if (Test-Path $build) { Remove-Item -Recurse -Force $build }
New-Item -ItemType Directory -Force -Path "$build\gen" | Out-Null
New-Item -ItemType Directory -Force -Path "$build\obj" | Out-Null
New-Item -ItemType Directory -Force -Path "$build\bin" | Out-Null

Write-Host "=== Step 1: Compile resources ==="
& "$bt\aapt2.exe" compile --dir "$proj\res" -o "$build\compiled_res.zip" 2>&1
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "=== Step 2: Link resources ==="
& "$bt\aapt2.exe" link `
    -o "$build\unsigned.apk" `
    -I "$plat" `
    --manifest "$proj\AndroidManifest.xml" `
    --java "$build\gen" `
    --auto-add-overlay `
    "$build\compiled_res.zip" 2>&1
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "=== Step 3: Compile Java ==="
$javaFiles = @("$proj\src\com\saman\app\MainActivity.java", "$build\gen\com\saman\app\R.java")
$ErrorActionPreference_old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& javac.exe -source 1.8 -target 1.8 -classpath "$plat" -d "$build\obj" @($javaFiles) 2>&1
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $ErrorActionPreference_old
if ($exitCode -ne 0) { throw "javac failed with exit code $exitCode" }

Write-Host "=== Step 4: DEX ==="
$classFiles = Get-ChildItem -Recurse "$build\obj" -Filter "*.class" | ForEach-Object { $_.FullName }
$d8 = "$bt\d8.bat"
if (-not (Test-Path $d8)) {
    $d8_35 = "C:\Users\ingaf\AppData\Local\Android\Sdk\build-tools\35.0.0\d8.bat"
    if (Test-Path $d8_35) { $d8 = $d8_35 }
}
& $d8 --release --output "$build\bin" --lib "$plat" @classFiles 2>&1
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "=== Step 5: Zipalign ==="
& "$bt\zipalign.exe" -f 4 "$build\unsigned.apk" "$build\aligned.apk" 2>&1
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "=== Step 6: Add DEX + Assets to APK ==="
Copy-Item "$build\aligned.apk" "$build\final.apk"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$build\final.apk", "Update")

# Remove old classes.dex if present
$oldDex = $zip.GetEntry("classes.dex")
if ($oldDex) { $oldDex.Delete() }

# Add classes.dex from d8 output
[void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$build\bin\classes.dex", "classes.dex")

# Add all asset files recursively
$assetFiles = Get-ChildItem -Recurse "$proj\assets" -File
foreach ($file in $assetFiles) {
    $relativePath = $file.FullName.Substring("$proj\assets\".Length).Replace("\", "/")
    $entryName = "assets/$relativePath"

    # Remove old entry if exists
    $oldEntry = $zip.GetEntry($entryName)
    if ($oldEntry) { $oldEntry.Delete() }

    Write-Host "  Adding: $entryName"
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $entryName)
}

$zip.Dispose()

Write-Host "=== Step 7: Zipalign again ==="
& "$bt\zipalign.exe" -f 4 "$build\final.apk" "$build\aligned_final.apk" 2>&1
if ($LASTEXITCODE -ne 0) { throw "zipalign final failed" }

Write-Host "=== Step 8: Generate keystore ==="
$keystore = "$proj\saman.keystore"
$keytool = "$env:JAVA_HOME\bin\keytool.exe"
if (-not (Test-Path $keytool)) { $keytool = "keytool" }
if (-not (Test-Path $keystore)) {
    $ErrorActionPreference_old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $keytool -genkey -v `
        -keystore "$keystore" `
        -alias saman `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass saman123 `
        -keypass saman123 `
        -dname "CN=SAMAN, OU=Dev, O=SAMAN, L=Unknown, ST=Unknown, C=VE" 2>&1 | Out-Null
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $ErrorActionPreference_old
    if ($exitCode -ne 0) { throw "keytool failed" }
}

Write-Host "=== Step 9: Sign APK ==="
$signer = "$bt\apksigner.bat"
if (-not (Test-Path $signer)) { $signer = "$bt\apksigner.bat" }
& $signer sign `
    --ks "$keystore" `
    --ks-key-alias saman `
    --ks-pass pass:saman123 `
    --key-pass pass:saman123 `
    --out "$proj\SAMAN.apk" `
    "$build\aligned_final.apk" 2>&1
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Host "=== DONE! ==="
Write-Host "APK created at: $proj\SAMAN.apk"
$apkSize = (Get-Item "$proj\SAMAN.apk").Length / 1MB
Write-Host ("Size: {0:N2} MB" -f $apkSize)
