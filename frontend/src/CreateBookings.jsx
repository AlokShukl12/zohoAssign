import api from "./api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateBookings.css";

export default function CreateBookings() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    service: "",
    address: "",
    customerName: "",
    customerPhone: "",
    scheduledTime: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case "service":
        if (!value.trim()) {
          newErrors.service = "Please select a service";
        } else {
          delete newErrors.service;
        }
        break;
      case "customerName":
        if (value && value.trim().length < 2) {
          newErrors.customerName = "Name must be at least 2 characters";
        } else if (value && !/^[a-zA-Z\s'-]+$/.test(value.trim())) {
          newErrors.customerName = "Name can only contain letters, spaces, hyphens, and apostrophes";
        } else {
          delete newErrors.customerName;
        }
        break;
      case "address":
        if (!value.trim()) {
          newErrors.address = "Address is required";
        } else if (value.trim().length < 10) {
          newErrors.address = "Please provide a complete address";
        } else {
          delete newErrors.address;
        }
        break;
      case "customerPhone":
        if (value && !/^\+?[\d\s-()]+$/.test(value)) {
          newErrors.customerPhone = "Invalid phone number format";
        } else if (value && value.replace(/\D/g, '').length < 10) {
          newErrors.customerPhone = "Phone number must have at least 10 digits";
        } else {
          delete newErrors.customerPhone;
        }
        break;
      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (submitted || errors[name]) {
      validateField(name, value);
    }
  };

  const handleFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const handleBlur = (fieldName) => {
    setFocusedField(null);
    validateField(fieldName, formData[fieldName]);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.service) {
      newErrors.service = "Service is required";
    }
    if (formData.customerName && formData.customerName.trim().length < 2) {
      newErrors.customerName = "Name must be at least 2 characters";
    }
    if (formData.customerName && !/^[a-zA-Z\s'-]+$/.test(formData.customerName.trim())) {
      newErrors.customerName = "Name can only contain letters, spaces, hyphens, and apostrophes";
    }
    if (!formData.address) {
      newErrors.address = "Address is required";
    } else if (formData.address.trim().length < 10) {
      newErrors.address = "Please provide a complete address";
    }
    if (formData.customerPhone && !/^\+?[\d\s-()]+$/.test(formData.customerPhone)) {
      newErrors.customerPhone = "Invalid phone number format";
    }
    if (formData.customerPhone && formData.customerPhone.replace(/\D/g, '').length < 10) {
      newErrors.customerPhone = "Phone number must have at least 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showToast = (message, type = "info") => {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    if (!validateForm()) {
      showToast("Please fix the errors in the form", "error");
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        document.querySelector(`[name="${firstErrorField}"]`)?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/bookings", formData);
      const bookingId = res.data.id;

      try {
        await api.post(`/bookings/${bookingId}/assign`);
        showToast("Booking created! Provider assigned automatically.", "success");
      } catch (assignError) {
        if (assignError.response?.status === 503 && assignError.response?.data?.retryable) {
          showToast(" Booking created! We'll assign a provider soon.", "warning");
        } else {
          showToast(" Booking created! Provider assignment pending.", "info");
        }
      }

      setShowSuccess(true);
      setSubmitted(false);

      setTimeout(() => {
        navigate("/admin");
      }, 2000);

    } catch (err) {
      showToast(err.message || "Failed to create booking. Please try again.", "error");
      setLoading(false);
    }
  };

  const isFormValid = Object.keys(errors).length === 0 &&
    formData.service &&
    formData.address;

  return (
    <div className="create-booking-page">
      <div className="booking-container">
        <div className="booking-header">
          <h1 className="page-title">
            <span className="title-icon"></span>
            Create Booking
          </h1>
          <p className="page-subtitle">Fill in the details to book a home service</p>
          <div className="navigation-links">
            <button onClick={() => navigate("/provider")} className="nav-button provider-btn">
              Provider Dashboard
            </button>
            <button onClick={() => navigate("/admin")} className="nav-button admin-btn">
              Admin Panel
            </button>
          </div>
        </div>

        {showSuccess && (
          <div className="success-message">
            <span className="success-icon">✓</span>
            <span>Booking created successfully! Redirecting...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="booking-form" noValidate>
          <div className="form-grid">
            <div className={`form-group ${focusedField === "service" ? "focused" : ""} ${errors.service ? "error" : ""} ${formData.service ? "filled" : ""}`}>
              <label htmlFor="service" className="form-label">
                Service Type <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <select
                  id="service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  onFocus={() => handleFocus("service")}
                  onBlur={() => handleBlur("service")}
                  className="form-input select-input"
                  required
                >
                  <option value="">Choose a service...</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical"> Electrical</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="carpentry"> Carpentry</option>
                </select>
                <span className="input-icon">▼</span>
              </div>
              {errors.service && (
                <span className="error-message">
                  <span className="error-icon"></span>
                  {errors.service}
                </span>
              )}
              {formData.service && !errors.service && (
                <span className="success-indicator">✓</span>
              )}
            </div>

            <div className={`form-group ${focusedField === "customerName" ? "focused" : ""} ${errors.customerName ? "error" : ""} ${formData.customerName ? "filled" : ""}`}>
              <label htmlFor="customerName" className="form-label">
                Your Name
              </label>
              <div className="input-wrapper">
                <input
                  id="customerName"
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  onFocus={() => handleFocus("customerName")}
                  onBlur={() => handleBlur("customerName")}
                  placeholder="Enter your full name"
                  className="form-input"
                  autoComplete="name"
                />
                <span className="input-icon">👤</span>
              </div>
              {errors.customerName && (
                <span className="error-message">
                  <span className="error-icon"></span>
                  {errors.customerName}
                </span>
              )}
              {formData.customerName && !errors.customerName && (
                <span className="success-indicator">✓</span>
              )}
            </div>

            <div className={`form-group ${focusedField === "customerPhone" ? "focused" : ""} ${errors.customerPhone ? "error" : ""} ${formData.customerPhone ? "filled" : ""}`}>
              <label htmlFor="customerPhone" className="form-label">
                Phone Number
              </label>
              <div className="input-wrapper">
                <input
                  id="customerPhone"
                  type="tel"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={handleChange}
                  onFocus={() => handleFocus("customerPhone")}
                  onBlur={() => handleBlur("customerPhone")}
                  placeholder="+1 234 567 8900"
                  className="form-input"
                  autoComplete="tel"
                />
                <span className="input-icon"></span>
              </div>
              {errors.customerPhone && (
                <span className="error-message">
                  <span className="error-icon"></span>
                  {errors.customerPhone}
                </span>
              )}
              {formData.customerPhone && !errors.customerPhone && (
                <span className="success-indicator">✓</span>
              )}
            </div>

            <div className={`form-group full-width ${focusedField === "address" ? "focused" : ""} ${errors.address ? "error" : ""} ${formData.address ? "filled" : ""}`}>
              <label htmlFor="address" className="form-label">
                Service Address <span className="required"></span>
              </label>
              <div className="input-wrapper">
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  onFocus={() => handleFocus("address")}
                  onBlur={() => handleBlur("address")}
                  placeholder="Enter the complete address where service is needed..."
                  rows="3"
                  className="form-input textarea-input"
                  required
                />
                <span className="input-icon address-icon"></span>
              </div>
              {errors.address && (
                <span className="error-message">
                  <span className="error-icon"></span>
                  {errors.address}
                </span>
              )}
              {formData.address && !errors.address && (
                <span className="success-indicator">✓</span>
              )}
              {formData.address && (
                <div className="character-count">
                  {formData.address.length} characters
                </div>
              )}
            </div>

            <div className={`form-group ${focusedField === "scheduledTime" ? "focused" : ""} ${formData.scheduledTime ? "filled" : ""}`}>
              <label htmlFor="scheduledTime" className="form-label">
                Preferred Time
              </label>
              <div className="input-wrapper">
                <input
                  id="scheduledTime"
                  type="datetime-local"
                  name="scheduledTime"
                  value={formData.scheduledTime}
                  onChange={handleChange}
                  onFocus={() => handleFocus("scheduledTime")}
                  onBlur={() => handleBlur("scheduledTime")}
                  min={new Date().toISOString().slice(0, 16)}
                  className="form-input"
                />
                <span className="input-icon">📅</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className={`submit-button ${loading ? "loading" : ""} ${isFormValid ? "valid" : "invalid"}`}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Creating Booking...</span>
                </>
              ) : (
                <>
                  <span className="button-icon">✓</span>
                  <span>Book Now</span>
                </>
              )}
            </button>

            {!isFormValid && submitted && (
              <p className="form-help-text">
                Please fill in all required fields to continue
              </p>
            )}
          </div>
        </form>

        <div className="quick-tips">
          <h3 className="tips-title">Quick Tips</h3>
          <ul className="tips-list">
            <li>Provide a complete address for faster service</li>
            <li>Add your phone number for provider contact</li>
            <li>Select preferred time for better scheduling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
