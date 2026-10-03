import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Account from "@/pages/Account";
import Favorites from "@/pages/Favorites";
import OurStory from "@/pages/OurStory";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProducts from "@/pages/admin/Products";
import AdminCategories from "@/pages/admin/Categories";
import AdminOrders from "@/pages/admin/Orders";
import AdminCustomers from "@/pages/admin/Customers";
import AdminCarousel from "@/pages/admin/Carousel";
import AdminCoupons from "@/pages/admin/Coupons";
import AdminSettings from "@/pages/admin/Settings";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="top-right" />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/productos" element={<Catalog />} />
              <Route path="/productos/:id" element={<ProductDetail />} />
              <Route path="/carrito" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cuenta" element={<Account />} />
              <Route path="/favoritos" element={<Favorites />} />
              <Route path="/nuestra-historia" element={<OurStory />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="productos" element={<AdminProducts />} />
              <Route path="categorias" element={<AdminCategories />} />
              <Route path="pedidos" element={<AdminOrders />} />
              <Route path="clientes" element={<AdminCustomers />} />
              <Route path="carrusel" element={<AdminCarousel />} />
              <Route path="cupones" element={<AdminCoupons />} />
              <Route path="configuracion" element={<AdminSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
