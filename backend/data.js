const { v4: uuid } = require("uuid");

// Providers database
const providers = [
  { 
    id: "p1", 
    name: "Ramesh Kumar", 
    available: true, 
    serviceTypes: ["plumbing", "electrical"],
    phone: "+91 98765 43210",
    rating: 4.8
  },
  { 
    id: "p2", 
    name: "Suresh Patel", 
    available: true, 
    serviceTypes: ["cleaning", "plumbing"],
    phone: "+91 98765 43211",
    rating: 4.6
  },
  { 
    id: "p3", 
    name: "Amit Sharma", 
    available: true, 
    serviceTypes: ["electrical", "carpentry"],
    phone: "+91 98765 43212",
    rating: 4.9
  }
];

// Bookings database
const bookings = [];

// Events/audit log
const events = [];

// Helper functions
const getProvider = (id) => providers.find(p => p.id === id);

const freeProvider = (id) => {
  const provider = getProvider(id);
  if (provider) {
    provider.available = true;
  }
};

const makeProviderBusy = (id) => {
  const provider = getProvider(id);
  if (provider) {
    provider.available = false;
  }
};

module.exports = { 
  providers, 
  bookings, 
  events, 
  uuid, 
  getProvider, 
  freeProvider,
  makeProviderBusy
};
