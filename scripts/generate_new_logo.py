import os
from PIL import Image, ImageDraw, ImageFilter
import math

BASE_DIR = r"E:\PROJECT\Music player"

def create_waven_logo(size=512):
    # Create high-res image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Background Rounded Squircle with subtle gradient
    # Margin
    m = int(size * 0.05)
    corner = int(size * 0.22)
    
    # Base dark obsidian container
    draw.rounded_rectangle([m, m, size - m, size - m], radius=corner, fill=(14, 14, 19, 255))
    
    # Inner border / glass glow
    border_draw = ImageDraw.Draw(img)
    border_draw.rounded_rectangle([m, m, size - m, size - m], radius=corner, outline=(255, 255, 255, 30), width=int(size * 0.015))
    
    # Subtle inner ambient glow in center
    glow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    cx, cy = size // 2, size // 2
    glow_draw.ellipse([cx - int(size * 0.35), cy - int(size * 0.35), cx + int(size * 0.35), cy + int(size * 0.35)], fill=(121, 40, 202, 70))
    glow_draw.ellipse([cx - int(size * 0.2), cy - int(size * 0.2), cx + int(size * 0.2), cy + int(size * 0.2)], fill=(204, 242, 46, 50))
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(int(size * 0.12)))
    img = Image.alpha_composite(img, glow_img)
    draw = ImageDraw.Draw(img)

    # 2. Draw modern stylized "W" Acoustic Soundwave Bars & Pulse
    # Center lines representing audio waveforms forming a modern W
    # Points for a 5-bar dynamic acoustic equalizer forming "W"
    bar_width = int(size * 0.065)
    r = bar_width // 2
    
    # Coordinates of 5 soundwave bars forming a V / W wave
    # (x, top, bottom, color)
    bars_data = [
        # Left outer bar
        (cx - int(size * 0.28), cy - int(size * 0.20), cy + int(size * 0.20), (204, 242, 46, 255)),
        # Left middle bar
        (cx - int(size * 0.14), cy - int(size * 0.10), cy + int(size * 0.28), (218, 255, 51, 255)),
        # Center pulse peak bar
        (cx, cy - int(size * 0.26), cy + int(size * 0.08), (219, 184, 255, 255)),
        # Right middle bar
        (cx + int(size * 0.14), cy - int(size * 0.10), cy + int(size * 0.28), (218, 255, 51, 255)),
        # Right outer bar
        (cx + int(size * 0.28), cy - int(size * 0.20), cy + int(size * 0.20), (204, 242, 46, 255))
    ]
    
    # Concentric orbital pulse ring around logo
    ring_draw = ImageDraw.Draw(img)
    ring_draw.arc([cx - int(size * 0.38), cy - int(size * 0.38), cx + int(size * 0.38), cy + int(size * 0.38)], start=30, end=150, fill=(204, 242, 46, 90), width=int(size * 0.012))
    ring_draw.arc([cx - int(size * 0.38), cy - int(size * 0.38), cx + int(size * 0.38), cy + int(size * 0.38)], start=210, end=330, fill=(121, 40, 202, 110), width=int(size * 0.012))
    
    # Sound wave connecting line / waveform curve
    # Draw geometric connecting lines between bar peaks to reinforce "W"
    wave_pts = [
        (cx - int(size * 0.28), cy - int(size * 0.15)),
        (cx - int(size * 0.14), cy + int(size * 0.22)),
        (cx, cy - int(size * 0.22)),
        (cx + int(size * 0.14), cy + int(size * 0.22)),
        (cx + int(size * 0.28), cy - int(size * 0.15))
    ]
    for i in range(len(wave_pts) - 1):
        draw.line([wave_pts[i], wave_pts[i+1]], fill=(204, 242, 46, 120), width=int(size * 0.018))
        
    # Draw the rounded vertical waveform bars
    for x, top, bottom, col in bars_data:
        draw.rounded_rectangle([x - r, top, x + r, bottom], radius=r, fill=col)
        # Highlight pip
        draw.ellipse([x - r//2, top + r//2, x + r//2, top + r + r//2], fill=(255, 255, 255, 220))

    # Center floating acoustic beacon point
    beacon_r = int(size * 0.025)
    draw.ellipse([cx - beacon_r, cy - int(size * 0.28) - beacon_r, cx + beacon_r, cy - int(size * 0.28) + beacon_r], fill=(204, 242, 46, 255))
    
    return img

def main():
    print("Generating brand new Nocturne Pulse WAVEN logo...")
    logo_512 = create_waven_logo(512)
    logo_192 = logo_512.resize((192, 192), Image.Resampling.LANCZOS)
    logo_144 = logo_512.resize((144, 144), Image.Resampling.LANCZOS)
    logo_96 = logo_512.resize((96, 96), Image.Resampling.LANCZOS)
    logo_72 = logo_512.resize((72, 72), Image.Resampling.LANCZOS)
    logo_48 = logo_512.resize((48, 48), Image.Resampling.LANCZOS)

    # Save to web and global assets
    dirs_to_update = [
        os.path.join(BASE_DIR, 'assets', 'img'),
        os.path.join(BASE_DIR, 'web', 'assets', 'img'),
        os.path.join(BASE_DIR, 'assets', 'logo'),
        os.path.join(BASE_DIR, 'android-app', 'app', 'src', 'main', 'assets', 'assets', 'logo')
    ]
    for d in dirs_to_update:
        os.makedirs(d, exist_ok=True)
        logo_512.save(os.path.join(d, 'logo-512.png'), 'PNG')
        logo_192.save(os.path.join(d, 'logo-192.png'), 'PNG')
        logo_48.save(os.path.join(d, 'favicon.png'), 'PNG')
        if 'assets/logo' in d.replace('\\', '/'):
            logo_512.save(os.path.join(d, 'waven_app_logo_512.png'), 'PNG')
            logo_192.save(os.path.join(d, 'waven_app_logo_192.png'), 'PNG')
            logo_192.save(os.path.join(d, 'apple-touch-icon.png'), 'PNG')

    # Save Android Launcher Mipmaps
    res_dir = os.path.join(BASE_DIR, 'android-app', 'app', 'src', 'main', 'res')
    mipmaps = {
        'mipmap-mdpi': logo_48,
        'mipmap-hdpi': logo_72,
        'mipmap-xhdpi': logo_96,
        'mipmap-xxhdpi': logo_144,
        'mipmap-xxxhdpi': logo_192,
        'drawable': logo_512
    }
    for mdir, mimg in mipmaps.items():
        target_dir = os.path.join(res_dir, mdir)
        os.makedirs(target_dir, exist_ok=True)
        mimg.save(os.path.join(target_dir, 'ic_launcher.png'), 'PNG')

    # Save favicon.ico
    logo_48.save(os.path.join(BASE_DIR, 'favicon.ico'), format='ICO', sizes=[(48, 48), (32, 32), (16, 16)])
    logo_48.save(os.path.join(BASE_DIR, 'web', 'favicon.ico'), format='ICO', sizes=[(48, 48), (32, 32), (16, 16)])

    # Generate matching SVG
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="haloGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7928CA" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#CCF22E" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0E0E13" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="neonCitron" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E5FF4D"/>
      <stop offset="100%" stop-color="#B2D900"/>
    </linearGradient>
    <linearGradient id="violetPulse" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EFDBFF"/>
      <stop offset="100%" stop-color="#9333EA"/>
    </linearGradient>
  </defs>
  <!-- Background Squircle -->
  <rect x="25" y="25" width="462" height="462" rx="110" fill="#0E0E13" stroke="rgba(255,255,255,0.12)" stroke-width="7"/>
  <!-- Ambient Center Glow -->
  <circle cx="256" cy="256" r="180" fill="url(#haloGlow)"/>
  <!-- Concentric Orbital Arcs -->
  <circle cx="256" cy="256" r="195" fill="none" stroke="#CCF22E" stroke-width="5" stroke-dasharray="140 320" stroke-linecap="round" opacity="0.4"/>
  <circle cx="256" cy="256" r="195" fill="none" stroke="#7928CA" stroke-width="5" stroke-dasharray="140 320" stroke-dashoffset="230" stroke-linecap="round" opacity="0.5"/>
  <!-- Connecting Geometric Wave Line -->
  <polyline points="112,180 184,368 256,144 328,368 400,180" fill="none" stroke="#CCF22E" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
  <!-- 5-Bar Acoustic Equalizer "W" Soundwave -->
  <rect x="96" y="154" width="32" height="204" rx="16" fill="url(#neonCitron)"/>
  <circle cx="112" cy="170" r="7" fill="#FFFFFF" opacity="0.85"/>
  <rect x="168" y="205" width="32" height="195" rx="16" fill="url(#neonCitron)"/>
  <circle cx="184" cy="221" r="7" fill="#FFFFFF" opacity="0.85"/>
  <rect x="240" y="123" width="32" height="174" rx="16" fill="url(#violetPulse)"/>
  <circle cx="256" cy="139" r="7" fill="#FFFFFF" opacity="0.95"/>
  <rect x="312" y="205" width="32" height="195" rx="16" fill="url(#neonCitron)"/>
  <circle cx="328" cy="221" r="7" fill="#FFFFFF" opacity="0.85"/>
  <rect x="384" y="154" width="32" height="204" rx="16" fill="url(#neonCitron)"/>
  <circle cx="400" cy="170" r="7" fill="#FFFFFF" opacity="0.85"/>
  <!-- Acoustic Master Beacon -->
  <circle cx="256" cy="112" r="11" fill="#CCF22E"/>
</svg>'''
    
    with open(os.path.join(BASE_DIR, 'assets', 'img', 'logo.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    with open(os.path.join(BASE_DIR, 'web', 'assets', 'img', 'logo.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    with open(os.path.join(BASE_DIR, 'assets', 'logo', 'logo.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)
    with open(os.path.join(BASE_DIR, 'android-app', 'app', 'src', 'main', 'assets', 'assets', 'logo', 'logo.svg'), 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print("Brand new Nocturne Pulse logo generated successfully across all targets!")

if __name__ == '__main__':
    main()
