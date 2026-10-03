"""CATTO E-commerce Backend - FastAPI + MongoDB"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import requests as http_requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Query, Header
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

# ---------- Pricing ----------
def final_price(price: float, discount: float) -> float:
    return round(price * (1 - (discount or 0) / 100), 2)

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
    return p

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
async def checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
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

    # Points redemption
    points_rate = settings.get("points_redeem_rate", 10)  # 1 point = X pesos
    points_per_peso = settings.get("points_per_peso", 0.001)
    redeem_points = min(payload.redeem_points or 0, user.get("points", 0))
    redeem_discount = round(redeem_points * points_rate, 2) if redeem_points > 0 else 0
    total_before_redeem = subtotal - discount_total
    redeem_discount = min(redeem_discount, total_before_redeem)
    total = round(total_before_redeem - redeem_discount, 2)
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

    # Points: deduct redemption, award earned (as pending until Confirmado by admin, but keep simple)
    if redeem_points > 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": -redeem_points}})
        await db.points_tx.insert_one({"id": new_id(), "user_id": user["id"], "type": "redeem", "amount": -redeem_points, "order_id": order["id"], "created_at": now_iso()})
    if points_earned > 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": points_earned}})
        await db.points_tx.insert_one({"id": new_id(), "user_id": user["id"], "type": "earn", "amount": points_earned, "order_id": order["id"], "created_at": now_iso()})

    # Clear cart
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": [], "updated_at": now_iso()}})

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
    await db.orders.update_one({"id": oid}, {"$set": {"status": payload.status, "updated_at": now_iso()}})
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
            {"title": "TRANSFERENCIA BANCARIA", "subtitle": "Pagá como quieras", "description": "15% OFF en pago con transferencia. Efectivo también disponible.", "image_url": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=85", "button_text": "COMPRAR", "button_link": "/productos", "order": 3},
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
