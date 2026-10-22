#!/usr/bin/env python3
"""
Extract media assets from updated PowerPoint presentation (DOC-20261022-WA0004.pptx)
and produce standard filenames inside assets/images/ with anti-spoiler redaction.
"""

import os
import zipfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def extract_and_process():
    pptx_path = "DOC-20261022-WA0004.pptx"
    if not os.path.exists(pptx_path):
        desktop_path = os.path.expanduser("~/Desktop/DOC-20261022-WA0004.pptx")
        if os.path.exists(desktop_path):
            import shutil
            shutil.copy(desktop_path, pptx_path)

    os.makedirs("assets/images_raw", exist_ok=True)
    os.makedirs("assets/images", exist_ok=True)

    with zipfile.ZipFile(pptx_path, 'r') as z:
        for filename in z.namelist():
            if filename.startswith("ppt/media/"):
                base = os.path.basename(filename)
                target = os.path.join("assets/images_raw", base)
                with open(target, 'wb') as f:
                    f.write(z.read(filename))

    font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/Helvetica.ttc"

    print("[1/8] Processing Stage 1 - Jog Falls cascade (Slide 1)...")
    im1 = Image.open("assets/images_raw/image1.jpg")
    im1.save("assets/images/stage1_jogfalls.png", "PNG")

    print("[2/8] Processing Stage 1 Answer - Vascular Waterfall diagram (Slide 2)...")
    im2 = Image.open("assets/images_raw/image2.jpeg")
    im2.save("assets/images/stage1_answer_waterfall.png", "PNG")

    print("[3/8] Processing Stage 2 - Pittsburgh facade with ANTI-SPOILER REDACTION (Slide 3)...")
    im3 = Image.open("assets/images_raw/image3.jpeg").convert("RGB")
    w, h = im3.size
    
    # Frosted blur on the inscription frieze
    blur_box = (15, 482, w - 15, 538)
    cropped_region = im3.crop(blur_box).filter(ImageFilter.GaussianBlur(8))
    im3.paste(cropped_region, blur_box)

    # Sleek dark banner overlay across the stone facade inscription
    overlay = Image.new("RGBA", im3.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    banner_rect = [15, 484, w - 15, 536]
    draw.rounded_rectangle(banner_rect, radius=8, fill=(15, 23, 42, 240), outline=(245, 158, 11, 245), width=2)
    
    font = ImageFont.truetype(font_path, 17)
    text = "[ 🏛️ INSTITUTION NAME REDACTED ]"
    bbox = font.getbbox(text)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = (banner_rect[0] + banner_rect[2] - text_w) // 2
    text_y = (banner_rect[1] + banner_rect[3] - text_h) // 2 - 2
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    im3 = Image.alpha_composite(im3.convert("RGBA"), overlay).convert("RGB")
    im3.save("assets/images/stage2_pittsburgh.png", "PNG")

    print("[4/8] Processing Stage 2 Answer - Cathedral of Learning & ROSE trial citation (Slide 4)...")
    im4 = Image.open("assets/images_raw/image4.jpg")
    im4.save("assets/images/stage2_answer_cathedral.png", "PNG")

    print("[5/8] Processing Stage 3 - Bengaluru 10-Spot Grid (Slide 5)...")
    im5 = Image.open("assets/images_raw/image5.jpeg")
    im5.save("assets/images/stage3_bengaluru_grid.png", "PNG")

    # Keep stage3_answer.png (Slide 6)
    if os.path.exists("assets/images_raw/image6.jpeg"):
        im6 = Image.open("assets/images_raw/image6.jpeg")
        im6.save("assets/images/stage3_answer.png", "PNG")

    print("[6/8] Processing Stage 4 - 3-Panel Picture Puzzle (Slide 7)...")
    im7 = Image.open("assets/images_raw/image7.jpeg")
    im7.save("assets/images/stage4_puzzle.png", "PNG")

    print("[7/8] Processing Stage 4 Answer - HAPE & Clinical Takeaways (Slide 8)...")
    im8 = Image.open("assets/images_raw/image8.jpeg")
    im8.save("assets/images/stage4_answer.png", "PNG")

    print("[8/8] Rendering Stage 5 - Kala-Azar Pictionary Rebus (Slide 9)...")
    # Composite Slide 9 using image9.jpeg (Charcoal) and image10.jpeg (Mohammad Azharuddin)
    cw, ch = 1600, 960
    pictionary_canvas = Image.new("RGB", (cw, ch), color=(15, 23, 42))
    pdraw = ImageDraw.Draw(pictionary_canvas)

    # Subtle background gradient
    for y in range(ch):
        r = int(15 + (y / ch) * 8)
        g = int(23 + (y / ch) * 12)
        b = int(42 + (y / ch) * 20)
        pdraw.line([(0, y), (cw, y)], fill=(r, g, b))

    # Header
    font_hdr = ImageFont.truetype(font_path, 22)
    pdraw.text((70, 45), "KICS 2026  •  BRAIN MEETS BEDSIDE", fill=(148, 163, 184), font=font_hdr)
    pdraw.text((1200, 45), "ROUND 5  •  PICTIONARY", fill=(56, 189, 248), font=font_hdr)
    pdraw.line([(70, 85), (cw - 70, 85)], fill=(51, 65, 85), width=2)

    # Question Title
    font_title = ImageFont.truetype(font_path, 40)
    pdraw.text((70, 115), "SOLVE THIS PICTIONARY (Hint: It’s a disease):", fill=(245, 158, 11), font=font_title)

    # Load and fit Charcoal (image9.jpeg)
    im_charcoal = Image.open("assets/images_raw/image9.jpeg").convert("RGB")
    im_charcoal.thumbnail((620, 620), Image.Resampling.LANCZOS)
    
    # Load and fit Mohammad Azharuddin (image10.jpeg)
    im_azhar = Image.open("assets/images_raw/image10.jpeg").convert("RGB")
    im_azhar.thumbnail((500, 620), Image.Resampling.LANCZOS)

    # Card 1: Charcoal
    card1_x, card1_y = 100, 200
    card1_w, card1_h = 600, 640
    pdraw.rounded_rectangle([card1_x, card1_y, card1_x + card1_w, card1_y + card1_h], radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)
    
    # Center charcoal image in card 1
    cx = card1_x + (card1_w - im_charcoal.width) // 2
    cy = card1_y + (card1_h - 60 - im_charcoal.height) // 2 + 10
    pictionary_canvas.paste(im_charcoal, (cx, cy))
    
    font_caption = ImageFont.truetype(font_path, 22)
    pdraw.text((card1_x + 30, card1_y + card1_h - 45), "Picture 1", fill=(148, 163, 184), font=font_caption)

    # Plus sign in middle
    font_plus = ImageFont.truetype(font_path, 72)
    pdraw.text((760, 470), "+", fill=(14, 165, 233), font=font_plus)

    # Card 2: Azharuddin
    card2_x, card2_y = 880, 200
    card2_w, card2_h = 600, 640
    pdraw.rounded_rectangle([card2_x, card2_y, card2_x + card2_w, card2_y + card2_h], radius=16, fill=(30, 41, 59), outline=(71, 85, 105), width=2)

    # Center azhar image in card 2
    ax = card2_x + (card2_w - im_azhar.width) // 2
    ay = card2_y + (card2_h - 60 - im_azhar.height) // 2 + 10
    pictionary_canvas.paste(im_azhar, (ax, ay))

    pdraw.text((card2_x + 30, card2_y + card2_h - 45), "Picture 2", fill=(148, 163, 184), font=font_caption)

    pictionary_canvas.save("assets/images/stage5_pictionary.png", "PNG")

    print("\nAll 8 standard stage images ready in assets/images/:")
    target_names = [
        "stage1_jogfalls.png",
        "stage1_answer_waterfall.png",
        "stage2_pittsburgh.png",
        "stage2_answer_cathedral.png",
        "stage3_bengaluru_grid.png",
        "stage4_puzzle.png",
        "stage4_answer.png",
        "stage5_pictionary.png"
    ]
    for fn in target_names:
        fp = os.path.join("assets/images", fn)
        if os.path.exists(fp):
            print(f"  ✅ {fn:30s}: {os.path.getsize(fp):,} bytes")
        else:
            print(f"  ❌ Missing: {fn}")

if __name__ == "__main__":
    extract_and_process()
