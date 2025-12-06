// src/App.tsx
// Root app component – router + layout + pages.
// Single dark-styled UI (no light/dark toggle anymore).

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Main app shell (sidebar + header + content area)
import MainLayout from "./layouts/MainLayout";

// Pages – all exported as *named* components from their files.
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LiveSessionsPage } from "./pages/LiveSessionsPage";
import { ClaimsPage } from "./pages/ClaimsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ShippingPage } from "./pages/ShippingPage";
import { CustomersPage } from "./pages/CustomersPage";
import { FinancePage } from "./pages/FinancePage";
import { SettingsPage } from "./pages/SettingsPage"; // named export

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* All pages live under the MainLayout shell */}
        <Route path="/" element={<MainLayout />}>
          {/* Default dashboard when opening the app */}
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Core modules */}
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="live-sessions" element={<LiveSessionsPage />} />
          <Route path="claims" element={<ClaimsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="shipping" element={<ShippingPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="finance" element={<FinancePage />} />

          {/* Global Settings – same dark layout as other modules */}
          <Route path="settings" element={<SettingsPage />} />

          {/* Fallback for unknown paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
