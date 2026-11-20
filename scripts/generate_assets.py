import os
import fitz
from PIL import Image

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#1F1A30" />
      <stop offset="50%" stop-color="#131318" />
      <stop offset="100%" stop-color="#0E0E13" />
    </radialGradient>
    <linearGradient id="limeVioletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#CCF22E" />
      <stop offset="45%" stop-color="#B1D500" />
      <stop offset="70%" stop-color="#DBB8FF" />
      <stop offset="100%" stop-color="#7928CA" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(204, 242, 46, 0.4)" />
      <stop offset="50%" stop-color="rgba(219, 184, 255, 0.2)" />
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.08)" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Container Base -->
  <rect width="512" height="512" rx="118" fill="url(#bgGlow)" />
  <rect x="3" y="3" width="506" height="506" rx="115" fill="none" stroke="url(#borderGrad)" stroke-width="4" />

  <!-- Concentric Grooves -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="2" stroke-dasharray="6 8" />
  <circle cx="256" cy="256" r="150" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1.5" />
  <circle cx="256" cy="256" r="110" fill="none" stroke="rgba(204,242,46,0.04)" stroke-width="1.5" stroke-dasharray="4 6" />

  <!-- Atmospheric Glow Aura -->
  <g filter="url(#glow)" opacity="0.55">
    <path d="M 100,210 C 120,210 142,350 176,350 C 210,350 228,170 256,170 C 284,170 302,350 336,350 C 370,350 392,210 412,210"
          fill="none" stroke="url(#limeVioletGrad)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Solid Waveform 'W' Monogram -->
  <path d="M 100,210 C 120,210 142,350 176,350 C 210,350 228,170 256,170 C 284,170 302,350 336,350 C 370,350 392,210 412,210"
        fill="none" stroke="url(#limeVioletGrad)" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />

  <!-- High-Precision Highlights -->
  <path d="M 108,210 C 124,210 138,315 170,338" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="7" stroke-linecap="round" />
  <path d="M 242,190 C 249,174 263,174 270,190" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="8" stroke-linecap="round" />
  <path d="M 342,338 C 374,315 388,210 404,210" fill="none" stroke="rgba(219,184,255,0.65)" stroke-width="7" stroke-linecap="round" />

  <!-- Sonic Cadence Equalizer Bars -->
  <g opacity="0.9">
    <rect x="176" y="410" width="12" height="24" rx="6" fill="#CCF22E" />
    <rect x="202" y="396" width="12" height="38" rx="6" fill="#B1D500" />
    <rect x="228" y="384" width="12" height="50" rx="6" fill="#DBB8FF" />
    <rect x="254" y="374" width="12" height="60" rx="6" fill="#CCF22E" />
    <rect x="280" y="384" width="12" height="50" rx="6" fill="#DBB8FF" />
    <rect x="306" y="396" width="12" height="38" rx="6" fill="#7928CA" />
    <rect x="332" y="410" width="12" height="24" rx="6" fill="#CCF22E" />
  </g>
</svg>"""

os.makedirs('assets/logo', exist_ok=True)
os.makedirs('web/assets/img', exist_ok=True)

with open('assets/logo/logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)
with open('web/assets/img/logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

doc = fitz.open(stream=svg_content.encode('utf-8'), filetype='svg')
page = doc[0]

def render_size(size, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    zoom = size / 512.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=True)
    pix.save(out_path)
    print(f'Rendered {size}x{size} -> {out_path}')

render_size(512, 'assets/logo/waven_app_logo_512.png')
render_size(192, 'assets/logo/waven_app_logo_192.png')
render_size(180, 'assets/logo/apple-touch-icon.png')
render_size(48, 'assets/logo/favicon.png')

render_size(512, 'web/assets/img/logo-512.png')
render_size(192, 'web/assets/img/logo-192.png')
render_size(48, 'web/assets/img/favicon.png')

# Android mipmaps
render_size(72, 'android-app/app/src/main/res/mipmap-hdpi/ic_launcher.png')
render_size(96, 'android-app/app/src/main/res/mipmap-xhdpi/ic_launcher.png')
render_size(144, 'android-app/app/src/main/res/mipmap-xxhdpi/ic_launcher.png')
render_size(192, 'android-app/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')
render_size(512, 'android-app/app/src/main/res/drawable/ic_launcher.png')

# Create favicon.ico
fav = Image.open('assets/logo/favicon.png')
fav.save('web/favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48)])
fav.save('favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48)])
print('All brand and icon assets successfully generated!')
