import { BrowserRouter, Routes, Route } from "react-router-dom";
import BookingDetails from "./BookingDetails";
import ProviderDashboard from "./ProviderDashboard";
import AdminPanel from "./AdminPanel";
import CreateBookings from "./CreateBookings";
import ErrorBoundary from "./ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CreateBookings />} />
          <Route path="/booking/:id" element={<BookingDetails />} />
          <Route path="/provider" element={<ProviderDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
