# CATTO - PRD & Estado del Proyecto

## Problema original
E-commerce premium independiente "CATTO" (Argentina, español). Identidad visual oscura editorial (negro / blanco / rojo), tipografía grande, animaciones modernas. Catálogo multi-categoría dinámico, variantes con stock por combinación, carrito, checkout con pedido a WhatsApp, sistema de puntos, panel admin completo.

## Arquitectura
- Backend: FastAPI + MongoDB (motor async). JWT custom + bcrypt. Emergent Object Storage para subidas.
- Frontend: React 19 + React Router 7 + Tailwind + shadcn/ui + framer motion + sonner.
- Fuentes: Syne (display), Plus Jakarta Sans (cuerpo), JetBrains Mono (precios/badges).
- Paleta: #0D0D0F background, #FAFAFA tipografía, #E60023 accent rojo.

## User Personas
1. **Cliente**: compra productos, gestiona cuenta, favoritos, puntos, hace checkout vía WhatsApp.
2. **Admin (Lucas)**: crea/edita productos y categorías, administra pedidos, carrusel, settings, puntos.

## Implementado (03-feb-2026, v1 MVP end-to-end)
- Auth JWT (register/login/me/logout) + endpoint listo para Google OAuth
- Catálogo dinámico con filtros (categoría, oferta, nuevo, destacado), búsqueda, orden
- Detalle de producto con variantes color/talle, stock por variante, galería
- Carrito persistido por cliente en Mongo
- Checkout con transferencia/efectivo (tarjeta deshabilitada hasta activarlo en settings)
- Opciones de entrega: punto de encuentro / Uber (costo cliente)
- Generación de pedido con numeración `CATTO-YYYY-NNNNNN`
- Apertura automática de WhatsApp con mensaje estructurado y datos reales
- Puntos: configurables (ratio por peso, pesos por punto al canjear), balance y transacciones
- Canje de puntos en checkout
- Favoritos
- Panel admin con secciones: Dashboard, Productos (CRUD + variantes + upload imágenes), Categorías (CRUD), Pedidos (listado + cambio de estado + modal detalle), Clientes, Carrusel (CRUD + upload), Configuración
- Seed inicial: admin + 7 categorías + 3 slides + 12 productos demo (removibles desde admin)
- Formato ARS Intl, mobile-first responsive, animaciones (marquee, fade-up, hover)
- Botón flotante de WhatsApp con mensaje default
- Historia editable desde admin

## Testing
- Backend validado curl end-to-end: login admin + cliente, CRUD productos/categorías/carrusel, carrito, favoritos, rechazo tarjeta, checkout completo con numeración + puntos, mis pedidos, admin cambia estado, settings, stats. **16/16 flujos PASS**.
- Frontend: homepage, catálogo, login→admin dashboard verificados por screenshot.

## Credenciales
- Admin: `lucascattolica989@gmail.com` / `CattoAdmin2026!` (cambiar desde admin → settings)
- WhatsApp configurado: `5493813007953`

## Backlog P0/P1
- P1: Google OAuth real (endpoint listo, falta integrar botón Emergent Google en /login)
- P1: Edición schema de atributos por categoría (ya persisten atributos_schema en categorías)
- P2: Email transaccional al cliente al confirmar pedido
- P2: Dashboard admin con gráficos (recharts)
- P2: Reseñas de productos
- P2: Códigos de cupón manuales
