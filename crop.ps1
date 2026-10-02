Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path 'public\uploads', 'public\assets' | Out-Null
$imgSrc = 'C:\Users\PC\.gemini\antigravity\brain\71493cf5-965d-40b6-9cc5-9bf75fe131c9\.user_uploaded\media_1790921793569.jpg'
$src = [System.Drawing.Bitmap]::FromFile($imgSrc)

# Crop artwork
$artRect = New-Object System.Drawing.Rectangle(123, 172, 254, 215)
$artCrop = $src.Clone($artRect, $src.PixelFormat)
$artCrop.Save('public\assets\sample-artwork.jpg', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$artCrop.Dispose()

# Crop logo
$logoRect = New-Object System.Drawing.Rectangle(200, 80, 100, 75)
$logoCrop = $src.Clone($logoRect, $src.PixelFormat)
$logoCrop.Save('public\assets\sample-logo.png', [System.Drawing.Imaging.ImageFormat]::Png)
$logoCrop.Dispose()

$src.Dispose()
Write-Output "Assets created successfully"
