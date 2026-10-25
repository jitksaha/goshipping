import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

os.makedirs("public/og", exist_ok=True)

# Colors
BG_COLOR = "#0D1318"
GRID_COLOR = "#151F28"
BORDER_COLOR = "#1E293B"
RED_PRIMARY = "#EA1D2C"
TEXT_WHITE = "#FFFFFF"
TEXT_MUTED = "#94A3B8"
PILL_BG = "#16202A"
PILL_BORDER = "#253342"
PILL_TEXT = "#E2E8F0"

W, H = 1200, 630

# Load fonts
try:
    font_badge = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
    font_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 48)
    font_desc = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
    font_pill = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
    font_footer = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
except Exception:
    font_badge = ImageFont.load_default()
    font_title = ImageFont.load_default()
    font_desc = ImageFont.load_default()
    font_pill = ImageFont.load_default()
    font_footer = ImageFont.load_default()

# Load logo
logo_path = "public/brand/logo-dark.png"
logo_img = None
if os.path.exists(logo_path):
    orig = Image.open(logo_path).convert("RGBA")
    aspect = orig.width / orig.height
    new_h = 50
    new_w = int(new_h * aspect)
    logo_img = orig.resize((new_w, new_h), Image.Resampling.LANCZOS)

pages = [
    {
        "filename": "og-home.png",
        "category": "CHINA → BANGLADESH LOGISTICS",
        "title": "China to Bangladesh, Delivered with Confidence",
        "desc": "Reliable Air & Sea shipment solutions with all-inclusive door-to-door delivery for businesses and online sellers across Bangladesh.",
        "pills": ["✈️ Air Freight (3–7 Days)", "🚢 Ocean Freight (35–45 Days)", "🛡️ 100% Customs Clearance", "📍 All 64 Districts"]
    },
    {
        "filename": "og-services.png",
        "category": "LOGISTICS SOLUTIONS",
        "title": "Complete China to Bangladesh Freight Services",
        "desc": "End-to-end supply chain support: Air Cargo, Sea Freight, DDP Door-to-Door Delivery, Customs Brokerage, and China Warehouses.",
        "pills": ["✈️ Express Air", "🚢 FCL / LCL Sea", "🏛️ Customs Brokerage", "🏢 30-Day Free Storage"]
    },
    {
        "filename": "og-air-shipment.png",
        "category": "FAST AIR CARGO",
        "title": "Air Shipment China to Bangladesh",
        "desc": "High-priority scheduled air freight from Guangzhou & Shenzhen directly to Dhaka HSIA with all-inclusive DDP customs clearance.",
        "pills": ["⏱️ 3–7 Days Transit", "✈️ Daily Allocations", "🛡️ DDP Port Clearing", "📦 Min 1.0 KG Accepted"]
    },
    {
        "filename": "og-sea-shipment.png",
        "category": "OCEAN & CONTAINER FREIGHT",
        "title": "Sea Shipment China to Bangladesh",
        "desc": "Cost-effective FCL and LCL container maritime shipping connecting China ports to Chittagong Port and Dhaka with full customs support.",
        "pills": ["🚢 35–45 Days Door Delivery", "📦 LCL from 1.0 CBM", "🏗️ 20ft / 40ft HQ Containers", "⚓ Chittagong Port Clearance"]
    },
    {
        "filename": "og-door-to-door.png",
        "category": "ALL-INCLUSIVE DDP LOGISTICS",
        "title": "Door-to-Door Delivery China to Bangladesh",
        "desc": "Zero customs bureaucracy. Direct doorstep delivery to your shop, office, or home across all 64 districts in Bangladesh.",
        "pills": ["🛡️ Customs Duty Included", "🚫 No IRC Required", "📦 Multi-Supplier Consolidation", "🚚 64 Districts Coverage"]
    },
    {
        "filename": "og-customs-clearance.png",
        "category": "PORT & AIRPORT C&F BROKERAGE",
        "title": "Bangladesh Customs Clearance & Brokerage",
        "desc": "Professional customs brokerage at Dhaka HSIA Cargo Complex and Chittagong Port terminals. Rapid assessment and NBR compliance.",
        "pills": ["🏛️ Dhaka HSIA & Chittagong", "📋 HS Code Advisory", "⚡ 24–48h Rapid Release", "📑 ASYCUDA World Filing"]
    },
    {
        "filename": "og-china-warehouse.png",
        "category": "CONSOLIDATION HUBS",
        "title": "China Warehouses: Guangzhou · Yiwu · Shenzhen",
        "desc": "Secure receiving facilities in China's key trade hubs. Free 30-day consolidation storage, parcel inspection, and export repacking.",
        "pills": ["🏢 Guangzhou Baiyun Hub", "🏢 Yiwu Trade City Hub", "🏢 Shenzhen Bao'an Hub", "🆓 30 Days Free Storage"]
    },
    {
        "filename": "og-how-it-works.png",
        "category": "STEP-BY-STEP PROCESS",
        "title": "How Shipping Works: China to Bangladesh",
        "desc": "A transparent 6-step freight journey from Chinese suppliers to your doorstep with live milestone tracking and expert advice.",
        "pills": ["1️⃣ Share Product Details", "2️⃣ Warehouse Intake", "3️⃣ Air/Sea Transit", "4️⃣ Doorstep Delivery"]
    },
    {
        "filename": "og-quote.png",
        "category": "INSTANT FREIGHT CALCULATOR",
        "title": "Get a Shipping Quote: China to Bangladesh",
        "desc": "Instant rate calculations for Air and Ocean freight. Transparent per-kg and per-CBM tariff estimates with zero hidden fees.",
        "pills": ["⚡ Instant Online Estimate", "💰 Transparent Tariff Rates", "✈️ Air & Sea Pricing", "📞 Direct Booking"]
    },
    {
        "filename": "og-faq.png",
        "category": "KNOWLEDGE BASE & GUIDELINES",
        "title": "Frequently Asked Questions (FAQ)",
        "desc": "Clear answers on air & sea transit timelines, chargeable volumetric weights, customs duties, restricted goods, and delivery.",
        "pills": ["⏱️ Transit Times", "⚖️ Chargeable Weight Rules", "📋 Duty Explanations", "🚫 Prohibited Items"]
    },
    {
        "filename": "og-about.png",
        "category": "ABOUT GOSHIPPING",
        "title": "Your Trusted China to Bangladesh Partner",
        "desc": "Empowering importers, commercial businesses, and e-commerce online sellers across Bangladesh with dependable logistics support.",
        "pills": ["🌍 Global Partner Network", "🏢 3 China Hubs", "🤝 Transparent Communication", "⭐ Dedicated Support"]
    },
    {
        "filename": "og-contact.png",
        "category": "GLOBAL DISPATCH DIRECTORY",
        "title": "Contact Go Shipping Operations Hubs",
        "desc": "Direct communications with licensed customs agents and operations coordinators in Dhaka, Chittagong, Guangzhou, Yiwu, and Shenzhen.",
        "pills": ["📞 +880 1797-252627", "💬 WhatsApp Instant Chat", "✉️ hello@goshipping.com.bd", "📍 Dhaka, Bangladesh"]
    },
    {
        "filename": "og-tracking.png",
        "category": "LIVE CONSIGNMENT TELEMETRY",
        "title": "Live Consignment Tracking",
        "desc": "Authenticated milestone tracking for air and sea shipments from China warehouse receipt to airport departure and port clearance.",
        "pills": ["📡 Live Milestone Telemetry", "✈️ Flight & Vessel Updates", "🏛️ Customs Release Notices", "🚚 Final Delivery Gate Pass"]
    },
    {
        "filename": "og-default.png",
        "category": "CHINA TO BANGLADESH FREIGHT",
        "title": "Go Shipping | Global Logistics & Forwarding",
        "desc": "Air freight, ocean container shipping, customs brokerage, and door-to-door delivery connecting China to Bangladesh.",
        "pills": ["✈️ Air Cargo", "🚢 Sea Shipping", "🛡️ DDP Door Delivery", "🏢 China Warehouses"]
    }
]

for p in pages:
    img = Image.new("RGBA", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 1. Subtle architectural background grid
    for x in range(0, W, 48):
        draw.line([(x, 0), (x, H)], fill=GRID_COLOR, width=1)
    for y in range(0, H, 48):
        draw.line([(0, y), (W, y)], fill=GRID_COLOR, width=1)

    # 2. Red Brand Top Line
    draw.rectangle([(0, 0), (W, 7)], fill=RED_PRIMARY)

    # 3. Outer border frame
    draw.rectangle([(0, 0), (W - 1, H - 1)], outline=BORDER_COLOR, width=1)

    # 4. Header: Logo (left) and Route Badge (right)
    if logo_img:
        img.paste(logo_img, (70, 50), logo_img)
    else:
        draw.text((70, 55), "GO SHIPPING", fill=TEXT_WHITE, font=font_title)

    route_text = "CHINA ⇄ BANGLADESH LOGISTICS"
    draw.rectangle([(W - 370, 56), (W - 70, 94)], fill=PILL_BG, outline=PILL_BORDER, width=1)
    draw.ellipse([(W - 355, 71), (W - 345, 81)], fill=RED_PRIMARY)
    draw.text((W - 335, 68), route_text, fill=PILL_TEXT, font=font_badge)

    # 5. Middle Content
    # Category badge
    cat_y = 150
    draw.text((70, cat_y), f"/ {p['category']}", fill=RED_PRIMARY, font=font_badge)

    # Title with text wrapping
    title_y = 180
    wrapped_title = textwrap.fill(p["title"], width=32)
    draw.text((70, title_y), wrapped_title, fill=TEXT_WHITE, font=font_title, spacing=10)

    # Description
    desc_y = 330
    wrapped_desc = textwrap.fill(p["desc"], width=68)
    draw.text((70, desc_y), wrapped_desc, fill=TEXT_MUTED, font=font_desc, spacing=8)

    # 6. Bottom Feature Pills
    pills_y = 445
    pill_x = 70
    for pill in p["pills"]:
        # Estimate text width
        bbox = draw.textbbox((0, 0), pill, font=font_pill)
        pill_w = (bbox[2] - bbox[0]) + 30
        draw.rectangle([(pill_x, pills_y), (pill_x + pill_w, pills_y + 40)], fill=PILL_BG, outline=PILL_BORDER, width=1)
        draw.text((pill_x + 15, pills_y + 11), pill, fill=PILL_TEXT, font=font_pill)
        pill_x += pill_w + 14

    # 7. Bottom Brand Anchor Line
    draw.line([(70, 545), (W - 70, 545)], fill=BORDER_COLOR, width=1)
    draw.text((70, 568), "Go Shipping Logistics Ltd. · Verified Commercial Freight Forwarding", fill=TEXT_MUTED, font=font_footer)
    draw.text((W - 330, 568), "goshipping.com.bd · +880 1797-252627", fill=TEXT_MUTED, font=font_footer)

    # Save PNG
    target_path = os.path.join("public/og", p["filename"])
    img.convert("RGB").save(target_path, "PNG", quality=95)
    print(f"Generated: {target_path} ({os.path.getsize(target_path)} bytes)")

print("All 14 OG preview images generated successfully!")
