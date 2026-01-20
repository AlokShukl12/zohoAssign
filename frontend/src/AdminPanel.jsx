import api from "./api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css";

const VALID_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED", "NO_SHOW"];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", search: "" });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, [filter.status]);

  const loadData = async () => {
    try {
      const params = filter.status ? { status: filter.status } : {};
      const [bookingsRes, eventsRes] = await Promise.all([
        api.get("/bookings", { params }),
        api.get("/events", { params: { limit: 100 } })
      ]);
      setBookings(bookingsRes.data);
      setEvents(eventsRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!selectedBooking || !overrideStatus) {
      alert("Please select a booking and status");
      return;
    }

    try {
      await api.post(`/bookings/${selectedBooking.id}/admin/override`, {
        status: overrideStatus,
        reason: overrideReason || "Admin override"
      });
      alert(" Status updated successfully");
      setSelectedBooking(null);
      setOverrideStatus("");
      setOverrideReason("");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to override status");
    }
  };

  const handleRetry = async (bookingId) => {
    try {
      await api.post(`/bookings/${bookingId}/retry`);
      alert(" Retry initiated");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to retry");
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return (
        b.id.toLowerCase().includes(search) ||
        b.service?.toLowerCase().includes(search) ||
        b.customerName?.toLowerCase().includes(search) ||
        b.address?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "PENDING").length,
    assigned: bookings.filter(b => b.status === "ASSIGNED").length,
    inProgress: bookings.filter(b => b.status === "IN_PROGRESS").length,
    completed: bookings.filter(b => b.status === "COMPLETED").length,
    failed: bookings.filter(b => b.status === "FAILED").length
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="admin-panel">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <button onClick={() => navigate("/")} className="back-button">← Back</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-number">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-number">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assigned</div>
          <div className="stat-number">{stats.assigned}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-number">{stats.inProgress}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-number">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-number">{stats.failed}</div>
        </div>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search bookings..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          {VALID_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bookings-table-container">
        <h2>All Bookings ({filteredBookings.length})</h2>
        <table className="bookings-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Service</th>
              <th>Customer</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Retries</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">No bookings found</td>
              </tr>
            ) : (
              filteredBookings.map(booking => (
                <tr key={booking.id}>
                  <td><code>{booking.id.slice(0, 8)}</code></td>
                  <td>{booking.service}</td>
                  <td>{booking.customerName}</td>
                  <td>{booking.providerName || "N/A"}</td>
                  <td>
                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>{booking.retryCount}/{booking.maxRetries || 3}</td>
                  <td>{new Date(booking.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setOverrideStatus(booking.status);
                      }}
                      className="btn-override"
                    >
                      Override
                    </button>
                    {["FAILED", "PENDING"].includes(booking.status) && (
                      <button
                        onClick={() => handleRetry(booking.id)}
                        className="btn-retry"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/booking/${booking.id}`)}
                      className="btn-view"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Override Status - {selectedBooking.id.slice(0, 8)}</h3>
            <div className="form-group">
              <label>New Status:</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
              >
                <option value="">Select status</option>
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Reason:</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for override..."
                rows="3"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleOverride} className="btn-primary">
                Confirm
              </button>
              <button onClick={() => setSelectedBooking(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="events-section">
        <h2>Recent Events (Latest 100)</h2>
        <div className="events-list">
          {events.length === 0 ? (
            <p className="no-events">No events recorded</p>
          ) : (
            events.map(event => (
              <div key={event.id} className="event-item">
                <div className="event-header">
                  <span className="event-booking-id">{event.bookingId?.slice(0, 8) || "N/A"}</span>
                  <span className="event-actor">{event.actor}</span>
                  <span className="event-time">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="event-details">
                  {event.oldStatus && (
                    <span className="status-transition">
                      {event.oldStatus} → {event.newStatus}
                    </span>
                  )}
                  <span className="event-reason">{event.reason}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
