# PowerShell script to add null-safety to all toLocaleString calls

$files = @(
    "components\DashboardView.tsx",
    "components\ENotaView.tsx",
    "components\PegawaiView.tsx",
    "components\PelangganView.tsx",
    "components\PosView.tsx",
    "components\PrinterModal.tsx",
    "components\ProdukView.tsx",
    "components\RekapView.tsx",
    "components\RiwayatView.tsx"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Pattern 1: obj.prop.toLocaleString → (obj?.prop || 0).toLocaleString
    $content = $content -replace '(\w+)\.(\w+)\.toLocaleString\(', '($1?.$2 || 0).toLocaleString('
    
    # Pattern 2: simple var.toLocaleString → (var || 0).toLocaleString (but skip already wrapped)
    $content = $content -replace '(?<!\(|\|\s)(\w+)\.toLocaleString\(''id-ID''\)', '($1 || 0).toLocaleString(''id-ID'')'
    
    # Pattern 3: calculation.toLocaleString → (calculation || 0).toLocaleString
    $content = $content -replace '\(([^)]+)\)\.toLocaleString\(''id-ID''\)', '(($1) || 0).toLocaleString(''id-ID'')'
    
    # Pattern 4: Number(x).toLocaleString → (Number(x) || 0).toLocaleString
    $content = $content -replace 'Number\(([^)]+)\)\.toLocaleString\(', '(Number($1) || 0).toLocaleString('
    
    Set-Content $file $content -NoNewline
    Write-Host "Fixed: $file"
}

Write-Host "`nAll files processed!"
