import os
import math
from PIL import Image, ImageDraw, ImageFilter

def generate_waven_app_logo(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    scale = 2
    master_size = 512 * scale  # 1024x1024 master canvas for crisp downsampling
    W, H = master_size, master_size

    def create_master(is_round=False):
        # 1. Base image with transparency
        img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # 2. Rich Deep Obsidian Background
        bg_canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for y in range(H):
            # Vertical gradient: Deep Charcoal (#090b10) to Rich Midnight (#141923)
            p = y / H
            r = int(9 + p * 11)
            g = int(11 + p * 14)
            b = int(16 + p * 19)
            for x in range(W):
                bg_canvas.putpixel((x, y), (r, g, b, 255))

        # Background Mask (Squircle or Circle)
        mask = Image.new('L', (W, H), 0)
        mask_draw = ImageDraw.Draw(mask)
        margin = int(W * 0.04)
        if is_round:
            mask_draw.ellipse([margin, margin, W - margin, H - margin], fill=255)
        else:
            rx = int(W * 0.22)  # Modern Android squircle radius
            mask_draw.rounded_rectangle([margin, margin, W - margin, H - margin], radius=rx, fill=255)

        base_bg = Image.composite(bg_canvas, Image.new('RGBA', (W, H), (0,0,0,0)), mask)

        # 3. Inner Cosmic Radial Glow (Purple -> Sky Blue -> Hot Pink)
        glow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        cx, cy = W // 2, H // 2
        max_radius = int(W * 0.42)
        
        # Draw soft concentric circles for lush audio aura
        aura_draw = ImageDraw.Draw(glow_layer)
        for r_curr in range(max_radius, 0, -4):
            factor = r_curr / max_radius
            alpha = int((1.0 - factor) * 110)
            # Hue morph from pink/violet to vibrant cyan
            if factor > 0.5:
                # Outer violet/magenta
                t = (factor - 0.5) / 0.5
                cr = int(139 + t * (236 - 139))
                cg = int(92 + t * (72 - 92))
                cb = int(246 + t * (153 - 246))
            else:
                # Inner electric cyan
                t = factor / 0.5
                cr = int(56 + t * (139 - 56))
                cg = int(189 + t * (92 - 189))
                cb = int(248 + t * (246 - 248))
            aura_draw.ellipse([cx - r_curr, cy - r_curr, cx + r_curr, cy + r_curr], fill=(cr, cg, cb, alpha))

        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(W * 0.04)))
        base_bg = Image.alpha_composite(base_bg, Image.composite(glow_layer, Image.new('RGBA', (W, H), (0,0,0,0)), mask))

        # 4. Soundwave Orbital Rings
        rings_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        r_draw = ImageDraw.Draw(rings_layer)
        ring_radii = [int(W * 0.28), int(W * 0.35)]
        for rad in ring_radii:
            r_draw.ellipse(
                [cx - rad, cy - rad, cx + rad, cy + rad],
                outline=(255, 255, 255, 35),
                width=int(W * 0.006)
            )

        # 5. Dynamic Equalizer Soundwave Bars Behind Music Note
        bar_heights = [0.18, 0.26, 0.38, 0.52, 0.38, 0.26, 0.18]
        bar_w = int(W * 0.038)
        gap = int(W * 0.024)
        total_w = len(bar_heights) * bar_w + (len(bar_heights) - 1) * gap
        start_x = cx - total_w // 2

        for i, bh in enumerate(bar_heights):
            bx = start_x + i * (bar_w + gap)
            bh_px = int(H * bh * 0.48)
            by1 = cy - bh_px // 2
            by2 = cy + bh_px // 2
            # Gradient bar
            r_draw.rounded_rectangle(
                [bx, by1, bx + bar_w, by2],
                radius=bar_w // 2,
                fill=(56, 189, 248, 140)
            )

        # 6. Central Iconic "W" Musical Note Motif (White + Cyan Core with Drop Glow)
        note_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        n_draw = ImageDraw.Draw(note_layer)

        # Beamed Eighth Note Geometry
        # Note Head 1 (Left)
        nh1_cx = int(W * 0.38)
        nh1_cy = int(H * 0.62)
        nh_rx = int(W * 0.082)
        nh_ry = int(H * 0.065)

        # Note Head 2 (Right)
        nh2_cx = int(W * 0.64)
        nh2_cy = int(H * 0.54)

        # Draw tilted elliptical note heads
        # Left head
        n_draw.ellipse(
            [nh1_cx - nh_rx, nh1_cy - nh_ry, nh1_cx + nh_rx, nh1_cy + nh_ry],
            fill=(255, 255, 255, 255)
        )
        # Right head
        n_draw.ellipse(
            [nh2_cx - nh_rx, nh2_cy - nh_ry, nh2_cx + nh_rx, nh2_cy + nh_ry],
            fill=(255, 255, 255, 255)
        )

        # Stem 1 (Left vertical stem)
        stem_w = int(W * 0.034)
        stem1_x = nh1_cx + nh_rx - stem_w
        stem_top_y = int(H * 0.32)
        n_draw.rectangle([stem1_x, stem_top_y, stem1_x + stem_w, nh1_cy], fill=(255, 255, 255, 255))

        # Stem 2 (Right vertical stem)
        stem2_x = nh2_cx + nh_rx - stem_w
        n_draw.rectangle([stem2_x, stem_top_y - int(H * 0.05), stem2_x + stem_w, nh2_cy], fill=(255, 255, 255, 255))

        # Connecting Top Beam (Angled thick bar)
        beam_h = int(H * 0.065)
        beam_poly = [
            (stem1_x, stem_top_y),
            (stem2_x + stem_w, stem_top_y - int(H * 0.05)),
            (stem2_x + stem_w, stem_top_y - int(H * 0.05) + beam_h),
            (stem1_x, stem_top_y + beam_h)
        ]
        n_draw.polygon(beam_poly, fill=(255, 255, 255, 255))

        # Inner vibrant core accent (electric cyan highlight inside beam)
        n_draw.line(
            [(stem1_x + int(W*0.008), stem_top_y + beam_h//2), 
             (stem2_x + stem_w - int(W*0.008), stem_top_y - int(H * 0.05) + beam_h//2)],
            fill=(56, 189, 248, 230),
            width=int(W * 0.014)
        )

        # Drop glow for the note
        shadow = note_layer.filter(ImageFilter.GaussianBlur(radius=int(W * 0.025)))
        
        # 7. Composite all layers
        final = Image.alpha_composite(base_bg, rings_layer)
        final = Image.alpha_composite(final, shadow)
        final = Image.alpha_composite(final, note_layer)

        # 8. Subtle Border Highlight
        border_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        border_draw = ImageDraw.Draw(border_layer)
        if is_round:
            border_draw.ellipse([margin, margin, W - margin, H - margin], outline=(255, 255, 255, 45), width=int(W * 0.008))
        else:
            border_draw.rounded_rectangle([margin, margin, W - margin, H - margin], radius=rx, outline=(255, 255, 255, 45), width=int(W * 0.008))

        final = Image.alpha_composite(final, border_layer)
        return final

    sq_master = create_master(is_round=False)
    rd_master = create_master(is_round=True)

    # Save master icons
    sq_master.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'waven_app_logo_512.png'), 'PNG')
    sq_master.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'waven_app_logo_192.png'), 'PNG')
    rd_master.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'waven_app_logo_round_512.png'), 'PNG')

    print(f"Master app logos generated in {out_dir}")
    return sq_master, rd_master

if __name__ == '__main__':
    generate_waven_app_logo('assets/logo')

