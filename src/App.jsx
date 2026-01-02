import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";

import LoginPage from "./pages/LoginPage/LoginPage";
import EventsPage from "./pages/EventsPage/EventsPage";
import DoorPage from "./pages/DoorPage/DoorPage";
import EventDetailPage from "./pages/EventDetailPage/EventDetailPage";

import "./App.css";

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/door/:code" element={<DoorPage />} />

      {/* Privado */}
      <Route element={<ProtectedRoute />}>
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Route>

      {/* Defaults */}
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
