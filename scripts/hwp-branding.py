"""Build opaque white square icons from the official, unchanged HWP logo."""
from PIL import Image
from pathlib import Path
from io import BytesIO

root = Path(__file__).resolve().parent.parent
art = Image.open(root / 'hwp-logo.png').convert('RGBA')
bounds = art.getbbox()
if not bounds:
    raise ValueError('Empty HWP logo')
art = art.crop(bounds)
for name, size, fraction in [
    ('hwp-favicon-48-white.png', 48, .94),
    ('hwp-touch-180-white.png', 180, .88),
    ('hwp-icon-192-white.png', 192, .88),
    ('hwp-icon-512-white.png', 512, .88),
    ('hwp-maskable-512-white.png', 512, .68),
]:
    logo = art.copy()
    edge = int(size * fraction)
    logo.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    canvas = Image.new('RGB', (size, size), '#ffffff')
    canvas.paste(logo, ((size - logo.width)//2, (size - logo.height)//2), logo)
    # Optimize the PNG without changing dimensions or its opaque white background.
    buffer = BytesIO()
    canvas.save(buffer, format='PNG', optimize=True)
    data = buffer.getvalue()
    decoded = Image.open(BytesIO(data))
    assert decoded.size == (size, size) and decoded.mode == 'RGB'
    assert decoded.getpixel((0,0)) == (255,255,255)
    path = root / name
    if path.exists():
        existing = Image.open(path)
        assert existing.size == (size, size) and existing.mode == 'RGB'
        assert existing.getpixel((0,0)) == (255,255,255)
        # Compare pixels, not compressor-specific file bytes.
        assert existing.tobytes() == decoded.tobytes(), 'Icon differs from official logo: ' + name
    else:
        path.write_bytes(data)
    print('Validated ' + name, flush=True)
