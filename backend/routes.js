const express = require("express");
const router = express.Router();
const { 
  providers, 
  bookings, 
  events, 
  uuid, 
  getProvider, 
  freeProvider,
  makeProviderBusy
} = require("./data");

const VALID_STATUSES = [
  "PENDING", 
  "ASSIGNED", 
  "IN_PROGRESS", 
  "COMPLETED", 
  "CANCELLED", 
  "FAILED", 
  "NO_SHOW"
];

// Event logging helper
const logEvent = (bookingId, oldStatus, newStatus, actor, reason, metadata = {}) => {
  const event = {
    id: uuid(),
    bookingId,
    oldStatus,
    newStatus,
    actor,
    reason,
    metadata,
    timestamp: new Date().toISOString()
  };
  events.push(event);
  return event;
};

router.get("/bookings", (req, res) => {
  try {
    const { status, providerId, customerName } = req.query;
    let filtered = [...bookings];
    
    if (status) {
      filtered = filtered.filter(b => b.status === status);
    }
    if (providerId) {
      filtered = filtered.filter(b => b.providerId === providerId);
    }
    if (customerName) {
      filtered = filtered.filter(b => 
        b.customerName?.toLowerCase().includes(customerName.toLowerCase())
      );
    }
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings", details: error.message });
  }
});

// Get single booking by ID
router.get("/bookings/:id", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch booking", details: error.message });
  }
});

// Create a new booking
router.post("/bookings", (req, res) => {
  try {
    const { service, address, customerName, customerPhone, scheduledTime } = req.body;
    
    if (!service || !address) {
      return res.status(400).json({ 
        error: "Service and address are required fields" 
      });
    }

    const booking = {
      id: uuid(),
      service: service.toLowerCase(),
      address,
      customerName: customerName || "Guest Customer",
      customerPhone: customerPhone || "",
      scheduledTime: scheduledTime || new Date().toISOString(),
      status: "PENDING",
      providerId: null,
      providerName: null,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cancelledBy: null,
      cancellationReason: null,
      completedAt: null
    };
    
    bookings.push(booking);
    logEvent(booking.id, null, "PENDING", "CUSTOMER", "Booking created", {
      service: booking.service,
      address: booking.address
    });
    
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to create booking", details: error.message });
  }
});

// Auto-assign provider to booking
router.post("/bookings/:id/assign", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    if (booking.status !== "PENDING") {
      return res.status(400).json({ 
        error: `Cannot assign provider to booking in ${booking.status} status` 
      });
    }

    // Find available provider matching service type
    const availableProvider = providers.find(p => 
      p.available && 
      (p.serviceTypes?.includes(booking.service) || !p.serviceTypes || p.serviceTypes.length === 0)
    );

    if (!availableProvider) {
      booking.retryCount++;
      booking.updatedAt = new Date().toISOString();
      
      if (booking.retryCount >= booking.maxRetries) {
        booking.status = "FAILED";
        logEvent(booking.id, "PENDING", "FAILED", "SYSTEM", 
          "No providers available after max retries", {
          retryCount: booking.retryCount
        });
        return res.status(503).json({ 
          error: "No providers available", 
          booking,
          retryable: false 
        });
      }
      
      logEvent(booking.id, "PENDING", "PENDING", "SYSTEM", 
        "No providers available, will retry", {
        retryCount: booking.retryCount
      });
      
      return res.status(503).json({ 
        error: "No providers available", 
        booking,
        retryable: true 
      });
    }

    // Assign provider
    booking.providerId = availableProvider.id;
    booking.providerName = availableProvider.name;
    booking.status = "ASSIGNED";
    booking.updatedAt = new Date().toISOString();
    makeProviderBusy(availableProvider.id);

    logEvent(booking.id, "PENDING", "ASSIGNED", "SYSTEM", "Auto-assigned provider", {
      providerId: availableProvider.id,
      providerName: availableProvider.name
    });
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to assign provider", details: error.message });
  }
});

// Provider actions (accept/reject)
router.post("/bookings/:id/provider/:action", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    const { action } = req.params;
    const { providerId } = req.body;

    if (booking.providerId !== providerId) {
      return res.status(403).json({ 
        error: "Provider not assigned to this booking" 
      });
    }

    if (action === "accept") {
      if (booking.status !== "ASSIGNED") {
        return res.status(400).json({ 
          error: `Cannot accept booking in ${booking.status} status` 
        });
      }
      
      booking.status = "IN_PROGRESS";
      booking.updatedAt = new Date().toISOString();
      logEvent(booking.id, "ASSIGNED", "IN_PROGRESS", "PROVIDER", 
        "Provider accepted booking");
        
    } else if (action === "reject") {
      if (booking.status !== "ASSIGNED") {
        return res.status(400).json({ 
          error: `Cannot reject booking in ${booking.status} status` 
        });
      }
      
      // Free the provider
      freeProvider(booking.providerId);
      booking.providerId = null;
      booking.providerName = null;
      booking.status = "PENDING";
      booking.retryCount++;
      booking.updatedAt = new Date().toISOString();
      
      logEvent(booking.id, "ASSIGNED", "PENDING", "PROVIDER", 
        "Provider rejected booking", {
        retryCount: booking.retryCount
      });

      if (booking.retryCount >= booking.maxRetries) {
        booking.status = "FAILED";
        logEvent(booking.id, "PENDING", "FAILED", "SYSTEM", 
          "Max retries reached after provider rejection");
      }
    } else {
      return res.status(400).json({ 
        error: "Invalid action. Use 'accept' or 'reject'" 
      });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to process provider action", 
      details: error.message 
    });
  }
});

// Complete booking
router.post("/bookings/:id/complete", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    if (booking.status !== "IN_PROGRESS") {
      return res.status(400).json({ 
        error: `Cannot complete booking in ${booking.status} status` 
      });
    }

    booking.status = "COMPLETED";
    booking.completedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    
    // Free the provider
    if (booking.providerId) {
      freeProvider(booking.providerId);
    }

    logEvent(booking.id, "IN_PROGRESS", "COMPLETED", "PROVIDER", 
      "Service completed");
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to complete booking", details: error.message });
  }
});

// Cancel booking
router.post("/bookings/:id/cancel", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    const { cancelledBy, reason } = req.body;
    
    if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot cancel booking in ${booking.status} status` 
      });
    }

    const oldStatus = booking.status;
    booking.status = "CANCELLED";
    booking.cancelledBy = cancelledBy || "CUSTOMER";
    booking.cancellationReason = reason || "No reason provided";
    booking.updatedAt = new Date().toISOString();

    // Free provider if assigned
    if (booking.providerId) {
      freeProvider(booking.providerId);
    }

    logEvent(booking.id, oldStatus, "CANCELLED", cancelledBy || "CUSTOMER", 
      reason || "Booking cancelled");
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel booking", details: error.message });
  }
});

router.post("/bookings/:id/no-show", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    if (!["ASSIGNED", "IN_PROGRESS"].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot mark no-show for booking in ${booking.status} status` 
      });
    }

    const oldStatus = booking.status;
    booking.status = "NO_SHOW";
    booking.updatedAt = new Date().toISOString();

    // Free provider
    if (booking.providerId) {
      freeProvider(booking.providerId);
      booking.providerId = null;
      booking.providerName = null;
    }

    logEvent(booking.id, oldStatus, "NO_SHOW", "SYSTEM", "Provider no-show");
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark no-show", details: error.message });
  }
});

router.post("/bookings/:id/retry", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    if (!["FAILED", "PENDING"].includes(booking.status)) {
      return res.status(400).json({ 
        error: `Cannot retry booking in ${booking.status} status` 
      });
    }

    booking.status = "PENDING";
    booking.updatedAt = new Date().toISOString();
    
    logEvent(booking.id, booking.status, "PENDING", "SYSTEM", "Retry initiated");
    
    const availableProvider = providers.find(p => 
      p.available && 
      (p.serviceTypes?.includes(booking.service) || !p.serviceTypes || p.serviceTypes.length === 0)
    );

    if (availableProvider) {
      booking.providerId = availableProvider.id;
      booking.providerName = availableProvider.name;
      booking.status = "ASSIGNED";
      makeProviderBusy(availableProvider.id);
      logEvent(booking.id, "PENDING", "ASSIGNED", "SYSTEM", 
        "Auto-assigned on retry");
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to retry booking", details: error.message });
  }
});

// Admin override status
router.post("/bookings/:id/admin/override", (req, res) => {
  try {
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    const { status, reason } = req.body;
    
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Valid statuses: ${VALID_STATUSES.join(", ")}` 
      });
    }

    const oldStatus = booking.status;
    booking.status = status;
    booking.updatedAt = new Date().toISOString();

    // Handle provider availability based on status
    if (["COMPLETED", "CANCELLED", "FAILED", "NO_SHOW"].includes(status) && booking.providerId) {
      freeProvider(booking.providerId);
    }

    logEvent(booking.id, oldStatus, status, "ADMIN", reason || "Admin override");
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: "Failed to override status", details: error.message });
  }
});

// Get booking events/history
router.get("/bookings/:id/events", (req, res) => {
  try {
    const bookingEvents = events
      .filter(e => e.bookingId === req.params.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(bookingEvents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events", details: error.message });
  }
});

// Get all events with filters
router.get("/events", (req, res) => {
  try {
    const { bookingId, actor, status, limit = 100 } = req.query;
    let filtered = [...events];
    
    if (bookingId) {
      filtered = filtered.filter(e => e.bookingId === bookingId);
    }
    if (actor) {
      filtered = filtered.filter(e => e.actor === actor);
    }
    if (status) {
      filtered = filtered.filter(e => e.newStatus === status);
    }
    
    filtered = filtered
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events", details: error.message });
  }
});
router.get("/events/:id", (req, res) => {
  try {
    const bookingEvents = events
      .filter(e => e.bookingId === req.params.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(bookingEvents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events", details: error.message });
  }
});

// Get all providers
router.get("/providers", (req, res) => {
  try {
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch providers", details: error.message });
  }
});

module.exports = router;
