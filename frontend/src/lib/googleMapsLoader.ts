/** Load Google Maps JS API once — shared by MissionMap and CoordinatorMap. */

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps?.Map) {
    return Promise.resolve();
  }

  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key not configured"));
  }

  loadPromise = new Promise((resolve, reject) => {
    (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
      loadPromise = null;
      reject(
        new Error(
          "Google Maps auth failed — check API key, billing, and localhost referrer. Demo keys have a daily quota."
        )
      );
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-crisisroute-maps="1"]'
    );

    if (existing) {
      if (window.google?.maps?.Map) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.crisisrouteMaps = "1";
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
