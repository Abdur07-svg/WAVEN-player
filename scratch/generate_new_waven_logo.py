import math
import os
from PIL import Image, ImageDraw, ImageFilter

def create_fluid_w_logo(size=1024):
    margin = int(size * 0.05)
    corner_radius = int(size * 0.22)
    center = size // 2
    
    # 1. Base Canvas
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    # Rounded squircle
    bg_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner_radius,
        fill=(10, 12, 19, 255)
    )
    
    # Rich Luxury Radial Gradient & Lighting
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    
    # Center ambient purple disc
    for r in range(440, 20, -10):
        alpha = int(45 * (1 - r / 440))
        g_draw.ellipse([center - r, center - r, center + r, center + r], fill=(124, 58, 237, alpha))
        
    # Top-right warm magenta splash
    for r in range(340, 20, -10):
        alpha = int(42 * (1 - r / 340))
        g_draw.ellipse([center + 130 - r, center - 120 - r, center + 130 + r, center - 120 + r], fill=(236, 72, 153, alpha))
        
    # Bottom-left electric cyan splash
    for r in range(340, 20, -10):
        alpha = int(42 * (1 - r / 340))
        g_draw.ellipse([center - 130 - r, center + 120 - r, center - 130 + r, center + 120 + r], fill=(6, 182, 212, alpha))
        
    # Mask to squircle
    squircle_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(squircle_mask).rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner_radius,
        fill=255
    )
    bg.paste(Image.alpha_composite(Image.new("RGBA", (size, size), (10, 12, 19, 255)), glow), (0, 0), squircle_mask)
    
    # 2. Vinyl Record Acoustic Grooves in background
    grooves = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gr_draw = ImageDraw.Draw(grooves)
    
    for gr in range(160, 420, 26):
        gr_draw.ellipse([center - gr, center - gr, center + gr, center + gr],
                        outline=(255, 255, 255, 14), width=1)
                        
    bg = Image.alpha_composite(bg, grooves)
    
    # 3. Master Smooth Curved Neon Soundwave "W"
    # To make an unmistakable "W":
    # Two valleys/troughs (bottoms of W), one central peak, two outer peaks.
    wave_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    w_draw = ImageDraw.Draw(wave_layer)
    
    num_points = 1000
    span_x = 540
    x_start = center - span_x // 2
    
    wave_coords = []
    for i in range(num_points):
        u = i / (num_points - 1) # 0 to 1
        x = x_start + u * span_x
        # Angle from -pi to 3*pi
        angle = -math.pi * 0.95 + u * (math.pi * 3.9)
        base_y = center - 5
        amplitude = 175
        center_falloff = 1.0 - 0.16 * math.sin(u * math.pi)
        # Note the '+' here to invert it into an upright 'W'
        y = base_y + math.cos(angle) * amplitude * center_falloff
        wave_coords.append((x, y, u))
        
    tube_radius = 42 # 84px diameter tube
    
    for x, y, u in wave_coords:
        # Gradient: Cyan (u=0) -> Deep Azure (0.25) -> Vivid Purple (0.5) -> Pink (0.75) -> Neon Rose (1.0)
        if u < 0.25:
            t = u / 0.25
            cr, cg, cb = int(6 + t*53), int(182 + t*(130-182)), int(212 + t*(246-212))
        elif u < 0.5:
            t = (u - 0.25) / 0.25
            cr, cg, cb = int(59 + t*109), int(130 + t*(85-130)), int(246 + t*(247-246))
        elif u < 0.75:
            t = (u - 0.5) / 0.25
            cr, cg, cb = int(168 + t*68), int(85 + t*(72-85)), int(247 + t*(153-247))
        else:
            t = (u - 0.75) / 0.25
            cr, cg, cb = int(236 + t*18), int(72 + t*(38-72)), int(153 + t*(94-153))
            
        w_draw.ellipse([x - tube_radius, y - tube_radius, x + tube_radius, y + tube_radius],
                       fill=(cr, cg, cb, 255))
                       
    # Glossy specular spine
    inner_glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ig_draw = ImageDraw.Draw(inner_glow_layer)
    for x, y, u in wave_coords:
        hr = tube_radius // 3
        ig_draw.ellipse([x - hr, y - hr - 4, x + hr, y + hr - 4], fill=(255, 255, 255, 140))
        
    glow_wide = wave_layer.filter(ImageFilter.GaussianBlur(radius=40))
    glow_mid = wave_layer.filter(ImageFilter.GaussianBlur(radius=16))
    ig_blurred = inner_glow_layer.filter(ImageFilter.GaussianBlur(radius=4))
    
    bg = Image.alpha_composite(bg, glow_wide)
    bg = Image.alpha_composite(bg, glow_mid)
    bg = Image.alpha_composite(bg, wave_layer)
    bg = Image.alpha_composite(bg, ig_blurred)
    
    # 4. Center Audio Equalizer Pulse Bars between W valleys
    eq_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    eq_draw = ImageDraw.Draw(eq_layer)
    
    # Add subtle glowing audio wave dots along the bottom rhythm line
    pulse_y = center + 240
    eq_draw.line([center - 240, pulse_y, center + 240, pulse_y], fill=(255, 255, 255, 30), width=2)
    
    for offset_x in [-200, -100, 0, 100, 200]:
        eq_draw.ellipse([center + offset_x - 5, pulse_y - 5, center + offset_x + 5, pulse_y + 5],
                        fill=(255, 255, 255, 180))
                        
    bg = Image.alpha_composite(bg, eq_layer)
    
    # 5. Outer Rim Frame
    rim = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    r_draw = ImageDraw.Draw(rim)
    r_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner_radius,
        outline=(255, 255, 255, 30),
        width=3
    )
    r_draw.line([margin + corner_radius, margin, size - margin - corner_radius, margin],
                fill=(255, 255, 255, 75), width=2)
    bg = Image.alpha_composite(bg, rim)
    
    # Circular version
    circle_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle_mask).ellipse([margin, margin, size - margin, size - margin], fill=255)
    round_icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_icon.paste(bg, (0, 0), circle_mask)
    
    return bg, round_icon

if __name__ == "__main__":
    out_dir = r"E:\PROJECT\Music player\scratch"
    sq, rd = create_fluid_w_logo(1024)
    sq.save(os.path.join(out_dir, "test_logo_w_upright.png"))
    rd.save(os.path.join(out_dir, "test_logo_w_upright_round.png"))
    print("Generated upright W logo!")
