'use client';

/**
 * Haversine distance between two coordinates in meters.
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Request geolocation and validate against restaurant coordinates.
 * Returns { allowed, distance, error }
 */
export const validateLocation = (restaurantLat, restaurantLon, radiusMeters = 100) => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ allowed: false, distance: null, error: 'Geolocation not supported by your browser' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = haversineDistance(latitude, longitude, restaurantLat, restaurantLon);
        resolve({
          allowed: distance <= radiusMeters,
          distance: Math.round(distance),
          userLat: latitude,
          userLon: longitude,
          error: null,
        });
      },
      (err) => {
        let errorMessage = 'Location permission denied';
        if (err.code === 1) errorMessage = 'Location permission denied. Please allow location access.';
        else if (err.code === 2) errorMessage = 'Location unavailable. Please try again.';
        else if (err.code === 3) errorMessage = 'Location request timed out.';
        resolve({ allowed: false, distance: null, error: errorMessage });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
};

export default validateLocation;
