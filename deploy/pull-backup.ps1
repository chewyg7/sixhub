<#
.SYNOPSIS
  Copies GTA 6 Hub's database and every uploaded file from the server to this PC.

.DESCRIPTION
  1. Makes a temporary copy of the database on the server.
  2. Downloads it (keeping the newest 30 here) and deletes it from the server.
  3. Downloads uploaded files that are new or changed since the last run.

  Nothing is left behind on the server; the backups only live on this PC.

  Needs ssh, scp and tar, which Windows 10/11 include. Run it from anywhere:

    powershell -ExecutionPolicy Bypass -File "$HOME\Documents\gtasixhub\deploy\pull-backup.ps1"

.PARAMETER Server
  How you SSH into the VPS, e.g. root@89.117.59.155.
#>
param(
  [string]$Server = "root@gtasixhub.com",
  [string]$Destination = (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "gtasixhub-backups"),
  [string]$DataDir = "/var/lib/gtasixhub",
  [int]$KeepDatabases = 30
)
$ErrorActionPreference = "Stop"

foreach ($cmd in "ssh", "scp", "tar") {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd isn't available. Turn on Windows' OpenSSH Client (Settings > System > Optional features)." }
}
$dbDir = Join-Path $Destination "database"
$upDir = Join-Path $Destination "uploads"
New-Item -ItemType Directory -Force -Path $dbDir, $upDir | Out-Null

$name = "gtasixhub-$(Get-Date -Format 'yyyyMMdd-HHmmss').db"
$remoteDb = "/tmp/$name"
Write-Host "1/3  Copying the database on the server..."
ssh $Server "sudo -u gtasixhub bash -c 'set -a; . /etc/gtasixhub.env; set +a; cd /srv/gtasixhub && node scripts/backup-db.mjs --out $remoteDb'"
if ($LASTEXITCODE -ne 0) { throw "Couldn't copy the database on the server." }

Write-Host "2/3  Downloading the database..."
try {
  scp -q "${Server}:$remoteDb" (Join-Path $dbDir $name)
  if ($LASTEXITCODE -ne 0) { throw "Downloading the database failed." }
} finally {
  ssh $Server "rm -f $remoteDb" | Out-Null
}
Get-ChildItem $dbDir -Filter "gtasixhub-*.db" | Sort-Object Name -Descending | Select-Object -Skip $KeepDatabases | Remove-Item
Write-Host "     Saved database\$name"

Write-Host "3/3  Checking uploads..."
$remote = ssh $Server "cd $DataDir/uploads && find . -type f -printf '%s\t%P\n'"
if ($LASTEXITCODE -ne 0) { throw "Couldn't list the uploads on the server." }
$need = @(foreach ($line in @($remote)) {
    if (-not $line) { continue }
    $size, $rel = $line -split "`t", 2
    $local = Join-Path $upDir ($rel -replace "/", "\")
    if (-not (Test-Path -LiteralPath $local) -or (Get-Item -LiteralPath $local).Length -ne [long]$size) { $rel }
  })
if ($need.Count -eq 0) {
  Write-Host "     Uploads are already up to date."
} else {
  Write-Host "     Downloading $($need.Count) new or changed file(s)..."
  $tag = [guid]::NewGuid().ToString("N").Substring(0, 10)
  $list = Join-Path $env:TEMP "gtasixhub-$tag.txt"
  $tarLocal = Join-Path $env:TEMP "gtasixhub-$tag.tar"
  # Unix line endings: tar on the server reads this list.
  [IO.File]::WriteAllText($list, (($need -join "`n") + "`n"))
  try {
    scp -q $list "${Server}:/tmp/gtasixhub-$tag.txt"
    ssh $Server "tar -C $DataDir/uploads -cf /tmp/gtasixhub-$tag.tar -T /tmp/gtasixhub-$tag.txt"
    if ($LASTEXITCODE -ne 0) { throw "Packing the uploads on the server failed." }
    scp -q "${Server}:/tmp/gtasixhub-$tag.tar" $tarLocal
    if ($LASTEXITCODE -ne 0) { throw "Downloading the uploads failed." }
    tar -xf $tarLocal -C $upDir
    if ($LASTEXITCODE -ne 0) { throw "Unpacking the uploads failed." }
  } finally {
    ssh $Server "rm -f /tmp/gtasixhub-$tag.txt /tmp/gtasixhub-$tag.tar" | Out-Null
    Remove-Item -Force -ErrorAction SilentlyContinue $list, $tarLocal
  }
}

Write-Host ""
Write-Host "Done. Backup is in $Destination"
