import api from "./api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ProviderDashboard.css";

export default function ProviderDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers]);

  const loadData = async () => {
    try {
      const [bookingsRes, providersRes] = await Promise.all([
        api.get("/bookings"),
        api.get("/providers")
      ]);
      setBookings(bookingsRes.data);
      setProviders(providersRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (bookingId, action) => {
    try {
      if (action === "accept") {
        await api.post(`/bookings/${bookingId}/provider/accept`, {
          providerId: selectedProvider
        });
        alert("Booking accepted!");
      } else if (action === "reject") {
        if (!confirm("Are you sure you want to reject this booking?")) return;
        await api.post(`/bookings/${bookingId}/provider/reject`, {
          providerId: selectedProvider
        });
        alert("Booking rejected");
      } else if (action === "complete") {
        await api.post(`/bookings/${bookingId}/complete`);
        alert(" Booking marked as completed!");
      } else if (action === "no-show") {
        if (!confirm("Mark this booking as no-show?")) return;
        await api.post(`/bookings/${bookingId}/no-show`);
        alert("Marked as no-show");
      } else if (action === "cancel") {
        const reason = prompt("Please provide a reason for cancellation:");
        if (!reason || !reason.trim()) {
          alert("Cancellation reason is required");
          return;
        }
        await api.post(`/bookings/${bookingId}/cancel`, {
          cancelledBy: "PROVIDER",
          reason: reason.trim()
        });
        alert(" Booking cancelled");
      }
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Action failed");
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  const myBookings = bookings.filter(b => b.providerId === selectedProvider);
  const assignedBookings = myBookings.filter(b => b.status === "ASSIGNED");
  const inProgressBookings = myBookings.filter(b => b.status === "IN_PROGRESS");

  return (
    <div className="provider-dashboard">
      <div className="dashboard-header">
        <h1>Provider Dashboard</h1>
        <button onClick={() => navigate("/")} className="back-button">← Back</button>
      </div>

      <div className="provider-selector">
        <label>Select Provider:</label>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.available ? "✓ Available" : "✗ Busy"}
            </option>
          ))}
        </select>
      </div>

      {assignedBookings.length > 0 && (
        <div className="bookings-section">
          <h2> New Assignments - Action Required ({assignedBookings.length})</h2>
          <div className="bookings-grid">
            {assignedBookings.map(booking => (
              <div key={booking.id} className="booking-card urgent">
                <h3>{booking.service}</h3>
                <p><strong>Customer:</strong> {booking.customerName}</p>
                <p><strong>Address:</strong> {booking.address}</p>
                <p><strong>Status:</strong> <span className={`status-badge status-${booking.status.toLowerCase()}`}>{booking.status}</span></p>
                <div className="card-actions">
                  <button
                    onClick={() => handleAction(booking.id, "accept")}
                    className="btn-accept"
                  >
                    ✓ Accept
                  </button>
                  <button
                    onClick={() => handleAction(booking.id, "reject")}
                    className="btn-reject"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inProgressBookings.length > 0 && (
        <div className="bookings-section">
          <h2> Active Jobs ({inProgressBookings.length})</h2>
          <div className="bookings-grid">
            {inProgressBookings.map(booking => (
              <div key={booking.id} className="booking-card">
                <h3>{booking.service}</h3>
                <p><strong>Customer:</strong> {booking.customerName}</p>
                <p><strong>Address:</strong> {booking.address}</p>
                <div className="card-actions">
                  <button
                    onClick={() => handleAction(booking.id, "complete")}
                    className="btn-complete"
                  >
                    ✓ Mark Complete
                  </button>
                  <button
                    onClick={() => handleAction(booking.id, "cancel")}
                    className="btn-cancel"
                  >
                    ✕ Cancel
                  </button>
                  <button
                    onClick={() => handleAction(booking.id, "no-show")}
                    className="btn-no-show"
                  >
                    No Show
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {assignedBookings.length === 0 && inProgressBookings.length === 0 && (
        <div className="empty-state">
          <p>No active bookings for this provider</p>
        </div>
      )}

      <div className="bookings-section">
        <h2>All My Bookings</h2>
        <div className="bookings-list">
          {myBookings.length === 0 ? (
            <p className="empty-state">No bookings found</p>
          ) : (
            myBookings.map(booking => (
              <div key={booking.id} className="booking-item">
                <div>
                  <strong>{booking.service}</strong> - {booking.customerName}
                  <br />
                  <small>{booking.address}</small>
                </div>
                <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                  {booking.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
