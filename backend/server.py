"""CATTO E-commerce Backend - FastAPI + MongoDB"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import ipaddress
import uuid
import logging
import asyncio
import bcrypt
import jwt
import httpx
import requests as http_requests
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Query, Header, BackgroundTasks
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("catto")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
APP_NAME = os.environ.get('APP_NAME', 'catto')
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

app = FastAPI(title="CATTO API")
api = APIRouter(prefix="/api")

# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def make_token(user_id: str, email: str, role: str, expires_minutes: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Acceso restringido al administrador")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=60 * 60 * 24 * 7, path="/",
    )

# ---------- Storage ----------
_storage_key = None
def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    r = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    r = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if r.status_code == 404:
        key = init_storage(force=True)
        r = http_requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    r.raise_for_status()
    return r.json()

def get_object(path: str):
    key = init_storage()
    r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 404:
        key = init_storage(force=True)
        r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------- Utils ----------
def new_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc

async def next_order_number() -> str:
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"order_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True, return_document=True,
    )
    return f"CATTO-{year}-{counter['seq']:06d}"

# ---------- Models ----------
class RegisterIn(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    address: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthIn(BaseModel):
    email: EmailStr
    name: str
    picture: Optional[str] = None

class GoogleSessionIn(BaseModel):
    session_id: str

class CouponIn(BaseModel):
    code: str
    discount_percent: float = 0
    discount_amount: float = 0
    max_uses: int = 0  # 0 = unlimited
    expires_at: Optional[str] = None  # ISO date
    active: bool = True
    description: Optional[str] = ""

class CategoryIn(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    attributes_schema: Optional[List[Dict[str, Any]]] = []
    active: bool = True

class VariantIn(BaseModel):
    color: Optional[str] = None
    size: Optional[str] = None
    stock: int = 0
    sku: Optional[str] = None

class ProductIn(BaseModel):
    name: str
    short_description: Optional[str] = ""
    description: Optional[str] = ""
    category_id: str
    brand: Optional[str] = ""
    sku: Optional[str] = ""
    main_image: Optional[str] = ""
    images: List[str] = []
    price: float
    discount_percent: float = 0
    stock: int = 0
    attributes: Dict[str, Any] = {}
    variants: List[VariantIn] = []
    is_featured: bool = False
    is_new: bool = False
    is_on_sale: bool = False
    active: bool = True
    tags: List[str] = []

class CarouselIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    description: Optional[str] = ""
    image_url: str
    button_text: Optional[str] = ""
    button_link: Optional[str] = ""
    order: int = 0
    active: bool = True

class CartItemIn(BaseModel):
    product_id: str
    variant_color: Optional[str] = None
    variant_size: Optional[str] = None
    quantity: int = 1

class CheckoutIn(BaseModel):
    payment_method: str  # transferencia | efectivo | tarjeta
    delivery_method: str  # punto_encuentro | uber
    delivery_address: Optional[str] = ""
    notes: Optional[str] = ""
    redeem_points: int = 0
    coupon_code: Optional[str] = None

class OrderStatusIn(BaseModel):
    status: str

class SettingsIn(BaseModel):
    store_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    store_description: Optional[str] = None
    our_story: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    delivery_methods: Optional[List[Dict[str, Any]]] = None
    payment_methods: Optional[List[Dict[str, Any]]] = None
    points_per_peso: Optional[float] = None
    points_redeem_rate: Optional[float] = None  # pesos per point
    card_payment_enabled: Optional[bool] = None

class ReviewIn(BaseModel):
    rating: int
    comment: Optional[str] = ""
    image_url: Optional[str] = ""
    order_id: str

# ---------- Pricing ----------
def final_price(price: float, discount: float) -> float:
    return round(price * (1 - (discount or 0) / 100), 2)

# ---------- Email (Emergent managed Resend) ----------
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "CATTO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set — skipping email")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} body={e.response.text[:300]}")
        return None
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return None

def _fmt_ars(n: float) -> str:
    try:
        return "$" + f"{int(round(n)):,}".replace(",", ".")
    except Exception:
        return f"${n}"

def _order_html(order: dict) -> str:
    items_rows = "".join(
        f'<tr><td style="padding:8px 0;color:#FAFAFA;font-family:Arial,sans-serif;font-size:14px">'
        f'{it["quantity"]}× {escape(it["name"])}'
        + ("".join(f' <span style="color:#A1A1AA;font-size:12px">· {escape(k)}: {escape(str(v))}</span>'
                   for k, v in [("Color", it.get("variant_color")), ("Talle", it.get("variant_size"))] if v))
        + f'</td><td style="padding:8px 0;color:#FAFAFA;font-family:Arial,sans-serif;font-size:14px;text-align:right">{_fmt_ars(it["final_price"] * it["quantity"])}</td></tr>'
        for it in order["items"]
    )
    coupon_row = (f'<tr><td style="padding:4px 0;color:#E60023;font-family:Arial,sans-serif;font-size:14px">Cupón ({escape(order.get("coupon_code") or "")})</td>'
                  f'<td style="padding:4px 0;color:#E60023;font-family:Arial,sans-serif;font-size:14px;text-align:right">-{_fmt_ars(order.get("coupon_discount", 0))}</td></tr>'
                  if order.get("coupon_discount", 0) > 0 else "")
    points_row = (f'<tr><td style="padding:4px 0;color:#E60023;font-family:Arial,sans-serif;font-size:14px">Puntos ({order["redeem_points"]})</td>'
                  f'<td style="padding:4px 0;color:#E60023;font-family:Arial,sans-serif;font-size:14px;text-align:right">-{_fmt_ars(order["redeem_discount"])}</td></tr>'
                  if order.get("redeem_discount", 0) > 0 else "")
    discount_row = (f'<tr><td style="padding:4px 0;color:#A1A1AA;font-family:Arial,sans-serif;font-size:14px">Descuento</td>'
                    f'<td style="padding:4px 0;color:#A1A1AA;font-family:Arial,sans-serif;font-size:14px;text-align:right">-{_fmt_ars(order["discount"])}</td></tr>'
                    if order.get("discount", 0) > 0 else "")
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#0D0D0F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0F">
<tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#121215;border:1px solid #27272A">
<tr><td style="padding:28px 32px;border-bottom:1px solid #27272A">
<div style="font-family:Arial,sans-serif;font-size:28px;font-weight:900;color:#FAFAFA;letter-spacing:-1px">CATTO<span style="color:#E60023">.</span></div>
</td></tr>
<tr><td style="padding:32px">
<p style="font-family:Arial,sans-serif;font-size:12px;color:#71717A;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">Confirmación de pedido</p>
<h1 style="font-family:Arial,sans-serif;font-size:28px;color:#FAFAFA;margin:0 0 8px;letter-spacing:-0.5px">¡Gracias, {escape(order["customer"]["first_name"])}!</h1>
<p style="font-family:Arial,sans-serif;font-size:14px;color:#A1A1AA;margin:0 0 24px">Tu pedido ya está registrado. Lucas te contactará por WhatsApp para coordinar.</p>
<div style="background:#0D0D0F;border:1px solid #27272A;padding:16px;margin:0 0 24px">
<p style="font-family:'Courier New',monospace;font-size:12px;color:#71717A;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 4px">N° Pedido</p>
<p style="font-family:'Courier New',monospace;font-size:20px;color:#FAFAFA;margin:0;font-weight:bold">{escape(order["order_number"])}</p>
</div>
<table role="presentation" width="100%" style="border-collapse:collapse">
{items_rows}
<tr><td colspan="2" style="border-top:1px solid #27272A;padding:12px 0 0"></td></tr>
<tr><td style="padding:4px 0;color:#A1A1AA;font-family:Arial,sans-serif;font-size:14px">Subtotal</td>
<td style="padding:4px 0;color:#A1A1AA;font-family:Arial,sans-serif;font-size:14px;text-align:right">{_fmt_ars(order["subtotal"])}</td></tr>
{discount_row}
{coupon_row}
{points_row}
<tr><td style="padding:12px 0 0;color:#FAFAFA;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;border-top:1px solid #27272A">Total</td>
<td style="padding:12px 0 0;color:#FAFAFA;font-family:Arial,sans-serif;font-size:18px;font-weight:bold;text-align:right;border-top:1px solid #27272A">{_fmt_ars(order["total"])}</td></tr>
</table>
<div style="margin:24px 0 0;padding:16px;background:#0D0D0F;border:1px solid #27272A">
<p style="font-family:Arial,sans-serif;font-size:13px;color:#A1A1AA;margin:0 0 4px"><strong style="color:#FAFAFA">Pago:</strong> {escape(order["payment_method"])}</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#A1A1AA;margin:0 0 4px"><strong style="color:#FAFAFA">Entrega:</strong> {escape("Punto de encuentro" if order["delivery_method"] == "punto_encuentro" else "Uber (a cargo del cliente)")}</p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#E60023;margin:8px 0 0"><strong>+{order["points_earned"]} puntos CATTO</strong> se acreditan al confirmar el pago</p>
</div>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #27272A;background:#0D0D0F">
<p style="font-family:Arial,sans-serif;font-size:11px;color:#71717A;margin:0;letter-spacing:1px;text-transform:uppercase">CATTO · Tienda independiente · Nunca te pedimos tu contraseña por email</p>
</td></tr>
</table>
</td></tr></table>
</body></html>"""

# ---------- Auth routes ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "El email ya está registrado")
    uid = new_id()
    user = {
        "id": uid,
        "email": email,
        "password_hash": hash_pw(payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "phone": payload.phone or "",
        "address": payload.address or "",
        "role": "customer",
        "points": 0,
        "picture": "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = make_token(uid, email, "customer")
    set_auth_cookie(response, token)
    return {"token": token, "user": clean(user)}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not check_pw(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email o contraseña incorrectos")
    token = make_token(user["id"], email, user.get("role", "customer"))
    set_auth_cookie(response, token)
    return {"token": token, "user": clean(dict(user))}

@api.post("/auth/google")
async def google_auth(payload: GoogleAuthIn, response: Response):
    """Simplified Google auth: trusts frontend-provided profile (Emergent managed)."""
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        uid = new_id()
        parts = payload.name.split(" ", 1)
        user = {
            "id": uid,
            "email": email,
            "password_hash": "",
            "first_name": parts[0],
            "last_name": parts[1] if len(parts) > 1 else "",
            "phone": "",
            "address": "",
            "role": "customer",
            "points": 0,
            "picture": payload.picture or "",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    token = make_token(user["id"], email, user.get("role", "customer"))
    set_auth_cookie(response, token)
    return {"token": token, "user": clean(dict(user))}

@api.post("/auth/google/session")
async def google_session_exchange(payload: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for user profile + issue local JWT.
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH"""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": payload.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(401, "Sesión inválida")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Google session exchange error: {e}")
        raise HTTPException(502, "Error al validar sesión Google")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture") or ""
    if not email:
        raise HTTPException(400, "Sesión sin email")

    user = await db.users.find_one({"email": email})
    if not user:
        uid = new_id()
        parts = name.split(" ", 1)
        user = {
            "id": uid, "email": email, "password_hash": "",
            "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "",
            "phone": "", "address": "", "role": "customer", "points": 0,
            "picture": picture, "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    else:
        if picture and not user.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": picture}})

    token = make_token(user["id"], email, user.get("role", "customer"))
    set_auth_cookie(response, token)
    return {"token": token, "user": clean(dict(user))}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Categories ----------
@api.get("/categories")
async def list_categories():
    cats = await db.categories.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(500)
    return cats

@api.get("/admin/categories")
async def admin_list_categories(_: dict = Depends(require_admin)):
    return await db.categories.find({}, {"_id": 0}).to_list(500)

@api.post("/admin/categories")
async def create_category(payload: CategoryIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.categories.insert_one(doc)
    return clean(doc)

@api.put("/admin/categories/{cid}")
async def update_category(cid: str, payload: CategoryIn, _: dict = Depends(require_admin)):
    await db.categories.update_one({"id": cid}, {"$set": payload.model_dump()})
    doc = await db.categories.find_one({"id": cid}, {"_id": 0})
    return doc

@api.delete("/admin/categories/{cid}")
async def delete_category(cid: str, _: dict = Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}

# ---------- Products ----------
def enrich_product(p):
    if not p:
        return p
    p.pop("_id", None)
    p["final_price"] = final_price(p.get("price", 0), p.get("discount_percent", 0))
    p["avg_rating"] = p.get("avg_rating", 0)
    p["review_count"] = p.get("review_count", 0)
    return p

async def recompute_product_rating(product_id: str):
    pipeline = [{"$match": {"product_id": product_id}}, {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}}]
    agg = await db.reviews.aggregate(pipeline).to_list(1)
    if agg:
        avg = round(agg[0]["avg"], 1)
        n = agg[0]["n"]
    else:
        avg, n = 0, 0
    await db.products.update_one({"id": product_id}, {"$set": {"avg_rating": avg, "review_count": n}})

@api.get("/products")
async def list_products(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    on_sale: Optional[bool] = None,
    is_new: Optional[bool] = None,
    sort: Optional[str] = "newest",
    limit: int = 100,
):
    q: Dict[str, Any] = {"active": True}
    if category_id:
        q["category_id"] = category_id
    if featured:
        q["is_featured"] = True
    if on_sale:
        q["is_on_sale"] = True
    if is_new:
        q["is_new"] = True
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]
    sort_map = {"price_asc": ("price", 1), "price_desc": ("price", -1), "newest": ("created_at", -1), "name": ("name", 1)}
    skey, sdir = sort_map.get(sort or "newest", ("created_at", -1))
    docs = await db.products.find(q, {"_id": 0}).sort(skey, sdir).to_list(limit)
    return [enrich_product(d) for d in docs]

@api.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return enrich_product(p)

@api.get("/admin/products")
async def admin_list_products(_: dict = Depends(require_admin)):
    docs = await db.products.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [enrich_product(d) for d in docs]

@api.post("/admin/products")
async def create_product(payload: ProductIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.products.insert_one(doc)
    return enrich_product(doc)

@api.put("/admin/products/{pid}")
async def update_product(pid: str, payload: ProductIn, _: dict = Depends(require_admin)):
    await db.products.update_one({"id": pid}, {"$set": payload.model_dump()})
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    return enrich_product(doc)

@api.delete("/admin/products/{pid}")
async def delete_product(pid: str, _: dict = Depends(require_admin)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}

# ---------- Carousel ----------
@api.get("/carousel")
async def list_carousel():
    docs = await db.carousel.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(50)
    return docs

@api.get("/admin/carousel")
async def admin_list_carousel(_: dict = Depends(require_admin)):
    return await db.carousel.find({}, {"_id": 0}).sort("order", 1).to_list(50)

@api.post("/admin/carousel")
async def create_slide(payload: CarouselIn, _: dict = Depends(require_admin)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.carousel.insert_one(doc)
    return clean(doc)

@api.put("/admin/carousel/{sid}")
async def update_slide(sid: str, payload: CarouselIn, _: dict = Depends(require_admin)):
    await db.carousel.update_one({"id": sid}, {"$set": payload.model_dump()})
    return await db.carousel.find_one({"id": sid}, {"_id": 0})

@api.delete("/admin/carousel/{sid}")
async def delete_slide(sid: str, _: dict = Depends(require_admin)):
    await db.carousel.delete_one({"id": sid})
    return {"ok": True}

# ---------- Coupons ----------
@api.get("/admin/coupons")
async def list_coupons(_: dict = Depends(require_admin)):
    docs = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs

@api.post("/admin/coupons")
async def create_coupon(payload: CouponIn, _: dict = Depends(require_admin)):
    code = payload.code.strip().upper()
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "El código ya existe")
    doc = payload.model_dump()
    doc["code"] = code
    doc["id"] = new_id()
    doc["uses"] = 0
    doc["created_at"] = now_iso()
    await db.coupons.insert_one(doc)
    return clean(doc)

@api.put("/admin/coupons/{cid}")
async def update_coupon(cid: str, payload: CouponIn, _: dict = Depends(require_admin)):
    update = payload.model_dump()
    update["code"] = update["code"].strip().upper()
    await db.coupons.update_one({"id": cid}, {"$set": update})
    return await db.coupons.find_one({"id": cid}, {"_id": 0})

@api.delete("/admin/coupons/{cid}")
async def delete_coupon(cid: str, _: dict = Depends(require_admin)):
    await db.coupons.delete_one({"id": cid})
    return {"ok": True}

async def validate_coupon(code: str, subtotal_after_discount: float) -> dict:
    """Return {'coupon': doc, 'discount': amount} or raise."""
    coupon = await db.coupons.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not coupon or not coupon.get("active", True):
        raise HTTPException(400, "Cupón inválido")
    if coupon.get("expires_at"):
        try:
            exp = datetime.fromisoformat(coupon["expires_at"].replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise HTTPException(400, "Cupón vencido")
        except HTTPException:
            raise
        except Exception:
            pass
    if coupon.get("max_uses", 0) and coupon.get("uses", 0) >= coupon["max_uses"]:
        raise HTTPException(400, "Cupón agotado")
    discount = 0.0
    if coupon.get("discount_percent", 0) > 0:
        discount = round(subtotal_after_discount * coupon["discount_percent"] / 100, 2)
    elif coupon.get("discount_amount", 0) > 0:
        discount = min(coupon["discount_amount"], subtotal_after_discount)
    return {"coupon": coupon, "discount": discount}

@api.post("/coupons/validate")
async def coupons_validate(payload: dict, user: dict = Depends(get_current_user)):
    code = (payload.get("code") or "").strip()
    subtotal = float(payload.get("subtotal") or 0)
    if not code:
        raise HTTPException(400, "Ingresá un código")
    result = await validate_coupon(code, subtotal)
    c = result["coupon"]
    return {"code": c["code"], "discount": result["discount"],
            "discount_percent": c.get("discount_percent", 0),
            "discount_amount": c.get("discount_amount", 0),
            "description": c.get("description", "")}

# ---------- Reviews ----------
@api.get("/products/{pid}/reviews")
async def product_reviews(pid: str):
    docs = await db.reviews.find({"product_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api.get("/reviews/eligible")
async def eligible_products(user: dict = Depends(get_current_user)):
    """Return list of {product_id, order_id, product_name, product_image} that user can review:
    present in a delivered order and not already reviewed by this user."""
    orders = await db.orders.find({"user_id": user["id"], "status": "Entregado"}, {"_id": 0}).to_list(500)
    reviewed = await db.reviews.find({"user_id": user["id"]}, {"_id": 0, "product_id": 1, "order_id": 1}).to_list(1000)
    reviewed_keys = {(r["product_id"], r["order_id"]) for r in reviewed}
    out = []
    for o in orders:
        for it in o.get("items", []):
            key = (it["product_id"], o["id"])
            if key in reviewed_keys:
                continue
            out.append({
                "product_id": it["product_id"], "order_id": o["id"],
                "order_number": o["order_number"],
                "product_name": it["name"], "product_image": it.get("image", ""),
            })
    # Deduplicate by product_id (keep latest order)
    seen = {}
    for item in out:
        seen[item["product_id"]] = item
    return list(seen.values())

@api.post("/products/{pid}/reviews")
async def create_review(pid: str, payload: ReviewIn, user: dict = Depends(get_current_user)):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(400, "La valoración debe estar entre 1 y 5")
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(403, "Pedido no encontrado")
    if order.get("status") != "Entregado":
        raise HTTPException(403, "Solo podés reseñar productos de pedidos entregados")
    if not any(it["product_id"] == pid for it in order.get("items", [])):
        raise HTTPException(400, "Ese producto no está en el pedido indicado")
    existing = await db.reviews.find_one({"user_id": user["id"], "product_id": pid, "order_id": payload.order_id})
    if existing:
        raise HTTPException(400, "Ya dejaste una reseña para este producto")
    doc = {
        "id": new_id(),
        "product_id": pid,
        "order_id": payload.order_id,
        "user_id": user["id"],
        "user_name": f"{user.get('first_name','')} {user.get('last_name','')[:1]}.".strip(),
        "rating": payload.rating,
        "comment": payload.comment or "",
        "image_url": payload.image_url or "",
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)
    await recompute_product_rating(pid)
    doc.pop("_id", None)
    return doc

@api.get("/admin/reviews")
async def admin_list_reviews(_: dict = Depends(require_admin)):
    return await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.delete("/admin/reviews/{rid}")
async def admin_delete_review(rid: str, _: dict = Depends(require_admin)):
    r = await db.reviews.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Reseña no encontrada")
    await db.reviews.delete_one({"id": rid})
    await recompute_product_rating(r["product_id"])
    return {"ok": True}

# ---------- Favorites ----------
@api.get("/favorites")
async def list_favorites(user: dict = Depends(get_current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = [f["product_id"] for f in favs]
    products = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    return [enrich_product(p) for p in products]

@api.post("/favorites/{pid}")
async def add_favorite(pid: str, user: dict = Depends(get_current_user)):
    existing = await db.favorites.find_one({"user_id": user["id"], "product_id": pid})
    if existing:
        return {"ok": True}
    await db.favorites.insert_one({"user_id": user["id"], "product_id": pid, "created_at": now_iso()})
    return {"ok": True}

@api.delete("/favorites/{pid}")
async def remove_favorite(pid: str, user: dict = Depends(get_current_user)):
    await db.favorites.delete_one({"user_id": user["id"], "product_id": pid})
    return {"ok": True}

# ---------- Cart ----------
async def get_or_create_cart(user_id: str):
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart:
        cart = {"user_id": user_id, "items": [], "updated_at": now_iso()}
        await db.carts.insert_one(cart)
    return cart

@api.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"])
    # Enrich items with product info
    enriched = []
    for item in cart.get("items", []):
        p = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
        if p:
            p = enrich_product(p)
            enriched.append({**item, "product": p})
    return {"items": enriched}

@api.post("/cart/add")
async def cart_add(item: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"])
    items = cart.get("items", [])
    found = False
    for it in items:
        if it["product_id"] == item.product_id and it.get("variant_color") == item.variant_color and it.get("variant_size") == item.variant_size:
            it["quantity"] += item.quantity
            found = True
            break
    if not found:
        items.append(item.model_dump())
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items, "updated_at": now_iso()}})
    return {"ok": True, "items_count": len(items)}

@api.post("/cart/update")
async def cart_update(item: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await get_or_create_cart(user["id"])
    items = [it for it in cart.get("items", []) if not (it["product_id"] == item.product_id and it.get("variant_color") == item.variant_color and it.get("variant_size") == item.variant_size)]
    if item.quantity > 0:
        items.append(item.model_dump())
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items, "updated_at": now_iso()}})
    return {"ok": True}

@api.post("/cart/clear")
async def cart_clear(user: dict = Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})
    return {"ok": True}

# ---------- Orders ----------
async def get_settings():
    s = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    return s or {}

@api.post("/orders/checkout")
async def checkout(payload: CheckoutIn, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    settings = await get_settings()
    if payload.payment_method == "tarjeta" and not settings.get("card_payment_enabled", False):
        raise HTTPException(400, "Pago con tarjeta próximamente deshabilitado")

    cart = await get_or_create_cart(user["id"])
    cart_items = cart.get("items", [])
    if not cart_items:
        raise HTTPException(400, "El carrito está vacío")

    order_items = []
    subtotal = 0.0
    discount_total = 0.0
    for it in cart_items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p or not p.get("active", True):
            raise HTTPException(400, f"Producto no disponible")
        price = p["price"]
        fp = final_price(price, p.get("discount_percent", 0))
        qty = it["quantity"]
        line_total = fp * qty
        line_discount = (price - fp) * qty
        subtotal += price * qty
        discount_total += line_discount
        order_items.append({
            "product_id": p["id"], "name": p["name"], "image": p.get("main_image", ""),
            "variant_color": it.get("variant_color"), "variant_size": it.get("variant_size"),
            "quantity": qty, "unit_price": price, "final_price": fp, "line_total": line_total,
        })

    total_before_extras = subtotal - discount_total

    # Coupon
    coupon_code = None
    coupon_discount = 0.0
    coupon_doc = None
    if payload.coupon_code:
        res = await validate_coupon(payload.coupon_code, total_before_extras)
        coupon_doc = res["coupon"]
        coupon_discount = res["discount"]
        coupon_code = coupon_doc["code"]
    total_after_coupon = max(0, total_before_extras - coupon_discount)

    # Points redemption
    points_rate = settings.get("points_redeem_rate", 10)
    points_per_peso = settings.get("points_per_peso", 0.001)
    redeem_points = min(payload.redeem_points or 0, user.get("points", 0))
    redeem_discount = round(redeem_points * points_rate, 2) if redeem_points > 0 else 0
    redeem_discount = min(redeem_discount, total_after_coupon)
    total = round(total_after_coupon - redeem_discount, 2)
    points_earned = int(round(total * points_per_peso)) if total > 0 else 0

    order_number = await next_order_number()
    order = {
        "id": new_id(), "order_number": order_number,
        "user_id": user["id"],
        "customer": {
            "first_name": user.get("first_name", ""), "last_name": user.get("last_name", ""),
            "email": user.get("email", ""), "phone": user.get("phone", ""),
            "address": user.get("address", ""),
        },
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount_total, 2),
        "coupon_code": coupon_code, "coupon_discount": coupon_discount,
        "redeem_points": redeem_points, "redeem_discount": redeem_discount,
        "total": total,
        "points_earned": points_earned,
        "payment_method": payload.payment_method,
        "delivery_method": payload.delivery_method,
        "delivery_address": payload.delivery_address or "",
        "notes": payload.notes or "",
        "status": "Pendiente",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)

    if coupon_doc:
        await db.coupons.update_one({"id": coupon_doc["id"]}, {"$inc": {"uses": 1}})

    # Points: deduct redemption at checkout, but DEFER earnings until admin marks order as Pagado
    if redeem_points > 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": -redeem_points}})
        await db.points_tx.insert_one({"id": new_id(), "user_id": user["id"], "type": "redeem", "amount": -redeem_points, "order_id": order["id"], "created_at": now_iso()})
    # points_earned are stored on the order but credited only on status=Pagado
    order["points_credited"] = False
    await db.orders.update_one({"id": order["id"]}, {"$set": {"points_credited": False}})

    # Clear cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})

    # Send confirmation email (non-blocking)
    try:
        html = _order_html(order)
        subject = f"CATTO — Confirmación de pedido {order['order_number']}"
        background.add_task(send_email, to=user["email"], subject=subject, html=html)
    except Exception as e:
        logger.error(f"Could not schedule confirmation email: {e}")

    return {"order": clean(order)}

@api.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    if o["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "No autorizado")
    return o

@api.get("/admin/orders")
async def admin_list_orders(_: dict = Depends(require_admin)):
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.put("/admin/orders/{oid}/status")
async def update_order_status(oid: str, payload: OrderStatusIn, _: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Pedido no encontrado")
    new_status = payload.status
    pts = order.get("points_earned", 0) or 0
    credited = order.get("points_credited", False)
    user_id = order["user_id"]
    update = {"status": new_status, "updated_at": now_iso()}

    # Credit points when transitioning to Pagado
    if new_status == "Pagado" and not credited and pts > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"points": pts}})
        await db.points_tx.insert_one({
            "id": new_id(), "user_id": user_id, "type": "earn", "amount": pts,
            "order_id": oid, "created_at": now_iso(),
            "note": f"Acreditado al marcar pedido {order['order_number']} como Pagado",
        })
        update["points_credited"] = True

    # Revoke credited points when cancelling
    if new_status == "Cancelado" and credited and pts > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"points": -pts}})
        await db.points_tx.insert_one({
            "id": new_id(), "user_id": user_id, "type": "revoke", "amount": -pts,
            "order_id": oid, "created_at": now_iso(),
            "note": f"Puntos revocados por cancelación del pedido {order['order_number']}",
        })
        update["points_credited"] = False

    # Also refund redeemed points on cancel
    redeem = order.get("redeem_points", 0) or 0
    if new_status == "Cancelado" and redeem > 0 and not order.get("redeem_refunded", False):
        await db.users.update_one({"id": user_id}, {"$inc": {"points": redeem}})
        await db.points_tx.insert_one({
            "id": new_id(), "user_id": user_id, "type": "refund", "amount": redeem,
            "order_id": oid, "created_at": now_iso(),
            "note": f"Reintegro de puntos canjeados en pedido {order['order_number']} (cancelado)",
        })
        update["redeem_refunded"] = True

    await db.orders.update_one({"id": oid}, {"$set": update})
    return await db.orders.find_one({"id": oid}, {"_id": 0})

# ---------- Points ----------
@api.get("/points/mine")
async def my_points(user: dict = Depends(get_current_user)):
    tx = await db.points_tx.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"points": user.get("points", 0), "transactions": tx}

# ---------- Settings ----------
@api.get("/settings")
async def public_settings():
    s = await get_settings()
    s.pop("id", None)
    return s

@api.put("/admin/settings")
async def update_settings(payload: SettingsIn, _: dict = Depends(require_admin)):
    changes = {k: v for k, v in payload.model_dump().items() if v is not None}
    changes["updated_at"] = now_iso()
    await db.settings.update_one({"id": "singleton"}, {"$set": changes}, upsert=True)
    s = await get_settings()
    s.pop("id", None)
    return s

# ---------- Admin stats ----------
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    total_orders = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": "Pendiente"})
    confirmed = await db.orders.count_documents({"status": "Confirmado"})
    products = await db.products.count_documents({})
    customers = await db.users.count_documents({"role": "customer"})
    pipeline = [{"$match": {"status": {"$in": ["Pagado", "Entregado", "Confirmado", "Preparando"]}}}, {"$group": {"_id": None, "total": {"$sum": "$total"}}}]
    sales = await db.orders.aggregate(pipeline).to_list(1)
    sales_total = sales[0]["total"] if sales else 0
    low_stock = await db.products.count_documents({"stock": {"$lt": 5}, "active": True})
    return {
        "total_orders": total_orders, "pending_orders": pending, "confirmed_orders": confirmed,
        "products": products, "customers": customers, "sales_total": sales_total,
        "low_stock": low_stock,
    }

@api.get("/admin/customers")
async def admin_customers(_: dict = Depends(require_admin)):
    docs = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return docs

# ---------- Uploads ----------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    content_type = file.content_type or "image/jpeg"
    result = put_object(path, data, content_type)
    rec = {
        "id": new_id(), "storage_path": result["path"],
        "original_filename": file.filename, "content_type": content_type,
        "size": result.get("size", len(data)), "is_deleted": False,
        "owner_id": user["id"], "created_at": now_iso(),
    }
    await db.files.insert_one(rec)
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}

@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "Archivo no encontrado")
    data, ct = get_object(path)
    return FastResponse(content=data, media_type=rec.get("content_type", ct))

# ---------- Seed ----------
DEMO_CATEGORIES = [
    {"name": "Calzado", "slug": "calzado", "image_url": "https://images.unsplash.com/photo-1784887879910-a93ffb442b9a?w=800&q=80", "attributes_schema": [
        {"key": "material", "label": "Material", "type": "text"},
        {"key": "style", "label": "Estilo", "type": "text"},
    ]},
    {"name": "Tecnología", "slug": "tecnologia", "image_url": "https://images.unsplash.com/photo-1585298723682-7115561c51b7?w=800&q=80", "attributes_schema": [
        {"key": "storage", "label": "Almacenamiento", "type": "text"},
        {"key": "ram", "label": "RAM", "type": "text"},
        {"key": "warranty", "label": "Garantía", "type": "text"},
    ]},
    {"name": "Accesorios", "slug": "accesorios", "image_url": "https://images.unsplash.com/photo-1772949399808-7020b02896b9?w=800&q=80", "attributes_schema": []},
    {"name": "Ropa", "slug": "ropa", "image_url": "https://images.unsplash.com/photo-1611261730549-03fea1555966?w=800&q=80", "attributes_schema": []},
    {"name": "Hogar", "slug": "hogar", "image_url": "https://images.unsplash.com/photo-1571898223382-0aa3499f0f2a?w=800&q=80", "attributes_schema": []},
    {"name": "Electrónica", "slug": "electronica", "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80", "attributes_schema": []},
    {"name": "Bazar", "slug": "bazar", "image_url": "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&q=80", "attributes_schema": []},
]

async def seed_if_empty():
    # Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@catto.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "password_hash": hash_pw(admin_pw),
            "first_name": "Lucas", "last_name": "Cattolica", "phone": "3813007953",
            "address": "", "role": "admin", "points": 0, "picture": "", "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    else:
        if not check_pw(admin_pw, existing.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_pw(admin_pw), "role": "admin"}})
        elif existing.get("role") != "admin":
            await db.users.update_one({"email": admin_email}, {"$set": {"role": "admin"}})

    # Settings
    if not await db.settings.find_one({"id": "singleton"}):
        await db.settings.insert_one({
            "id": "singleton",
            "store_name": "CATTO",
            "whatsapp_number": os.environ.get("WHATSAPP_NUMBER", "5493813007953"),
            "store_description": "Tienda independiente de productos premium. Tecnología, moda, hogar y mucho más.",
            "our_story": "CATTO nace como un proyecto independiente con la idea de reunir, en una experiencia moderna de compra online, productos de distintas categorías cuidadosamente seleccionados. Un espacio diferente, honesto y directo. Hecho con dedicación por una sola persona que cree que una tienda puede ser también una curaduría.",
            "social_links": {"instagram": "", "tiktok": "", "facebook": ""},
            "delivery_methods": [
                {"id": "punto_encuentro", "label": "Punto de encuentro", "cost_note": "Sin costo"},
                {"id": "uber", "label": "Uber / Delivery", "cost_note": "Costo a cargo del cliente"},
            ],
            "payment_methods": [
                {"id": "transferencia", "label": "Transferencia bancaria", "enabled": True},
                {"id": "efectivo", "label": "Efectivo", "enabled": True},
                {"id": "tarjeta", "label": "Tarjeta — Próximamente", "enabled": False},
            ],
            "points_per_peso": 0.001,  # 1 point per $1000 spent
            "points_redeem_rate": 10,  # 1 point = $10 discount (500 pts = $5000)
            "card_payment_enabled": False,
            "created_at": now_iso(),
        })

    # Categories
    if await db.categories.count_documents({}) == 0:
        for c in DEMO_CATEGORIES:
            await db.categories.insert_one({**c, "id": new_id(), "active": True, "description": "", "created_at": now_iso()})

    cats = {c["slug"]: c["id"] for c in await db.categories.find({}, {"_id": 0}).to_list(500)}

    # Carousel
    if await db.carousel.count_documents({}) == 0:
        slides = [
            {"title": "URBAN / TECH / ESSENTIALS", "subtitle": "Nueva colección", "description": "Lo mejor en calzado, tecnología y accesorios en un solo lugar.", "image_url": "https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=1600&q=85", "button_text": "VER CATÁLOGO", "button_link": "/productos", "order": 1},
            {"title": "HASTA 30% OFF", "subtitle": "Ofertas CATTO", "description": "Descuentos reales en productos seleccionados.", "image_url": "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1600&q=85", "button_text": "VER OFERTAS", "button_link": "/productos?on_sale=true", "order": 2},
            {"title": "TRANSFERENCIA BANCARIA", "subtitle": "Pagá como quieras", "description": "Transferencia o efectivo. Elegí cómo abonar tu pedido.", "image_url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=85", "button_text": "COMPRAR", "button_link": "/productos", "order": 3},
        ]
        for s in slides:
            await db.carousel.insert_one({**s, "id": new_id(), "active": True, "created_at": now_iso()})

    # Products
    if await db.products.count_documents({}) == 0:
        demos = [
            {"name": "Zapatillas Urban SB Dark Edition", "cat": "calzado", "brand": "Nike", "price": 180000, "discount": 19, "img": "https://images.unsplash.com/photo-1784887879910-a93ffb442b9a?w=1000&q=85", "is_new": True, "is_featured": True, "is_on_sale": True, "variants": [{"color": "Negro", "size": "40", "stock": 2}, {"color": "Negro", "size": "41", "stock": 4}, {"color": "Negro", "size": "42", "stock": 1}, {"color": "Blanco", "size": "41", "stock": 3}]},
            {"name": "Auriculares Wireless Studio", "cat": "tecnologia", "brand": "Sony", "price": 250000, "discount": 16, "img": "https://images.unsplash.com/photo-1585298723682-7115561c51b7?w=1000&q=85", "is_featured": True, "is_on_sale": True, "attributes": {"warranty": "6 meses", "storage": "N/A"}},
            {"name": "Reloj Chrono Gold Velvet", "cat": "accesorios", "brand": "Catto", "price": 390000, "discount": 18, "img": "https://images.unsplash.com/photo-1772949399808-7020b02896b9?w=1000&q=85", "is_on_sale": True, "is_featured": True},
            {"name": "Campera Urban Tech Waterproof", "cat": "ropa", "brand": "North", "price": 220000, "discount": 14, "img": "https://images.unsplash.com/photo-1574083119440-c338e49a6bf5?w=1000&q=85", "is_new": True, "variants": [{"color": "Negro", "size": "M", "stock": 5}, {"color": "Negro", "size": "L", "stock": 3}, {"color": "Verde", "size": "M", "stock": 2}]},
            {"name": "Lámpara Minimalist Industrial", "cat": "hogar", "brand": "Catto Home", "price": 115000, "discount": 15, "img": "https://images.unsplash.com/photo-1571898223382-0aa3499f0f2a?w=1000&q=85", "is_featured": True},
            {"name": "Smartphone Pro 128GB", "cat": "tecnologia", "brand": "Samsung", "price": 850000, "discount": 10, "img": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1000&q=85", "is_new": True, "attributes": {"storage": "128GB", "ram": "8GB", "warranty": "12 meses"}},
            {"name": "Mochila Urban Everyday", "cat": "accesorios", "brand": "Catto", "price": 75000, "discount": 0, "img": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1000&q=85", "is_new": True},
            {"name": "Zapatillas Running Air Max", "cat": "calzado", "brand": "Nike", "price": 165000, "discount": 10, "img": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000&q=85", "is_on_sale": True, "variants": [{"color": "Negro", "size": "41", "stock": 3}, {"color": "Negro", "size": "42", "stock": 2}, {"color": "Rojo", "size": "42", "stock": 1}]},
            {"name": "Teclado Mecánico RGB", "cat": "tecnologia", "brand": "Logitech", "price": 95000, "discount": 0, "img": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&q=85", "is_featured": True},
            {"name": "Remera Oversize Minimal", "cat": "ropa", "brand": "Catto", "price": 32000, "discount": 0, "img": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1000&q=85", "variants": [{"color": "Negro", "size": "M", "stock": 8}, {"color": "Negro", "size": "L", "stock": 5}, {"color": "Blanco", "size": "M", "stock": 4}]},
            {"name": "Taza Cerámica Premium", "cat": "bazar", "brand": "Catto Home", "price": 12000, "discount": 0, "img": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1000&q=85"},
            {"name": "Smart TV 50\" 4K", "cat": "electronica", "brand": "LG", "price": 950000, "discount": 12, "img": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1000&q=85", "is_on_sale": True, "is_featured": True, "attributes": {"storage": "4K UHD", "warranty": "12 meses"}},
        ]
        for d in demos:
            product = {
                "id": new_id(),
                "name": d["name"],
                "short_description": f"{d['brand']} — {d['name']}",
                "description": f"{d['name']}. Producto premium curado por CATTO.",
                "category_id": cats.get(d["cat"]),
                "brand": d["brand"],
                "sku": f"CATTO-{uuid.uuid4().hex[:6].upper()}",
                "main_image": d["img"],
                "images": [d["img"]],
                "price": d["price"],
                "discount_percent": d.get("discount", 0),
                "stock": sum(v["stock"] for v in d.get("variants", [])) if d.get("variants") else 10,
                "attributes": d.get("attributes", {}),
                "variants": d.get("variants", []),
                "is_featured": d.get("is_featured", False),
                "is_new": d.get("is_new", False),
                "is_on_sale": d.get("is_on_sale", False),
                "active": True,
                "tags": [d["cat"], d["brand"].lower()],
                "created_at": now_iso(),
            }
            await db.products.insert_one(product)

# ---------- Lifecycle ----------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.products.create_index("category_id")
        await db.orders.create_index("user_id")
        await seed_if_empty()
        try:
            init_storage()
            logger.info("Storage inicializado")
        except Exception as e:
            logger.warning(f"Storage init falló: {e}")
    except Exception as e:
        logger.error(f"Startup error: {e}")

@api.get("/")
async def root():
    return {"message": "CATTO API online"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
