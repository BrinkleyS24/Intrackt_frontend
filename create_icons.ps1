# Create basic icon files for Chrome extension
Add-Type -AssemblyName System.Drawing

# Create a simple blue square icon
function Create-Icon($size, $path) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Fill with blue background
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(59, 130, 246))
    $graphics.FillRectangle($brush, 0, 0, $size, $size)
    
    # Add white "M" for Mail
    $font = New-Object System.Drawing.Font("Arial", [math]::Floor($size * 0.6), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $text = "M"
    $textSize = $graphics.MeasureString($text, $font)
    $x = ($size - $textSize.Width) / 2
    $y = ($size - $textSize.Height) / 2
    $graphics.DrawString($text, $font, $textBrush, $x, $y)
    
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
}

# Create icons
Create-Icon 16 "popup\dist\icons\icon16.png"
Create-Icon 48 "popup\dist\icons\icon48.png"  
Create-Icon 128 "popup\dist\icons\icon128.png"

Write-Host "Icons created successfully!"