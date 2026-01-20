import api from "./api";
import { useParams, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./BookingDetails.css";

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const loadBookingData = useCallback(async () => {
    if (!id) return;
    try {
      const [bookingRes, eventsRes] = await Promise.all([
        api.get(`/bookings/${id}`),
        api.get(`/bookings/${id}/events`)
      ]);
      
      if (bookingRes?.data) {
        setBooking(bookingRes.data);
        setError(null);
      } else {
        setBooking(null);
        setError("Booking not found");
      }
      
      if (eventsRes?.data) {
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error("Failed to load booking:", err);
      setError(err.response?.status === 404 ? "Booking not found" : "Failed to load booking");
      setBooking(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError("No booking ID provided");
      setLoading(false);
      return;
    }
    loadBookingData();
    const interval = setInterval(loadBookingData, 3000);
    return () => clearInterval(interval);
  }, [id, loadBookingData]);

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert("Please provide a cancellation reason");
      return;
    }

    try {
      await api.post(`/bookings/${id}/cancel`, {
        cancelledBy: "CUSTOMER",
        reason: cancelReason
      });
      alert(" Booking cancelled successfully");
      setShowCancelModal(false);
      setCancelReason("");
      await loadBookingData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to cancel booking");
    }
  };


  const formattedScheduledTime = useMemo(() => {
    if (!booking?.scheduledTime) return "Not scheduled";
    try {
      const date = new Date(booking.scheduledTime);
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }
      return date.toLocaleString();
    } catch (e) {
      return "Invalid date";
    }
  }, [booking?.scheduledTime]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error && !booking) return <div className="error">{error}</div>;
  if (!booking || !booking.id) {
    return <div className="error">Booking not found</div>;
  }

  const canCancel = booking?.status && ["PENDING", "ASSIGNED"].includes(String(booking.status));

  return (
    <div className="booking-details">
      <div className="details-header">
        <h1>Booking Details</h1>
        <button onClick={() => navigate("/")} className="back-button">Back</button>
      </div>

      <div className="booking-card">
        <div className="booking-header">
          <h2>Booking #{booking?.id ? String(booking.id).slice(0, 8) : "N/A"}</h2>
          <span className={`status-badge status-${booking?.status ? String(booking.status).toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '') : 'unknown'}`}>
            {booking?.status || "UNKNOWN"}
          </span>
        </div>

        <div className="booking-info">
          <div className="info-row">
            <strong>Service:</strong> <span>{booking?.service || "N/A"}</span>
          </div>
          <div className="info-row">
            <strong>Customer:</strong> <span>{booking?.customerName || "N/A"}</span>
          </div>
          <div className="info-row">
            <strong>Phone:</strong> <span>{booking?.customerPhone || "N/A"}</span>
          </div>
          <div className="info-row">
            <strong>Address:</strong> <span>{booking?.address || "N/A"}</span>
          </div>
          <div className="info-row">
            <strong>Provider:</strong> 
            <span>{booking?.providerName || "Not assigned"}</span>
          </div>
          <div className="info-row">
            <strong>Scheduled:</strong> 
            <span>{formattedScheduledTime}</span>
          </div>
          <div className="info-row">
            <strong>Retry Count:</strong> <span>{(booking?.retryCount ?? 0)}/{(booking?.maxRetries || 3)}</span>
          </div>
        </div>

        {canCancel && (
          <div className="action-buttons">
            <button onClick={() => setShowCancelModal(true)} className="btn-cancel">
              Cancel Booking
            </button>
          </div>
        )}

        {booking?.cancelledBy && (
          <div className="cancellation-info">
            <strong>Cancelled by:</strong> {booking.cancelledBy}
            {booking?.cancellationReason && (
              <div><strong>Reason:</strong> {booking.cancellationReason}</div>
            )}
          </div>
        )}
      </div>

      <div className="events-section">
        <h2>Booking Timeline</h2>
        <div className="timeline">
          {!events || events.length === 0 ? (
            <div className="no-events">No events recorded</div>
          ) : (
            (Array.isArray(events) ? events : [])
              .filter(event => event != null)
              .map((event, i) => {
                let formattedTime = "Invalid date";
                try {
                  if (event && event.timestamp) {
                    const date = new Date(event.timestamp);
                    if (!isNaN(date.getTime())) {
                      formattedTime = date.toLocaleString();
                    }
                  }
                } catch (e) {
                }
                
                const eventKey = event?.id || `event-${i}`;
                
                return (
                  <div key={eventKey} className="timeline-item">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="event-header">
                        <span className="event-status">{event?.newStatus || "N/A"}</span>
                        <span className="event-actor">{event?.actor || "SYSTEM"}</span>
                        <span className="event-time">
                          {formattedTime}
                        </span>
                      </div>
                      {event?.reason && (
                        <div className="event-reason">{event.reason}</div>
                      )}
                      {event?.oldStatus && event?.newStatus && (
                        <div className="event-transition">
                          {event.oldStatus} → {event.newStatus}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {showCancelModal && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Cancel Booking</h3>
            <p>Are you sure you want to cancel this booking?</p>
            <div className="form-group">
              <label>Reason:</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                rows="3"
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleCancel} className="btn-primary">
                Confirm
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
