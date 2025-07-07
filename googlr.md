Here’s a **clean and fixed** version of your key logic:

---

### ✅ **Fix 1: Use `Infinity` instead of `null` for distance**

Update this in your `fetchProviders()` function:

```ts
distance: location?.coords 
  ? calculateDistance(
      location.coords.latitude,
      location.coords.longitude,
      provider.location?.latitude || 0,
      provider.location?.longitude || 0
    )
  : Infinity  // Use Infinity, not null
```

Do this **everywhere** you map `distance`, including `loadMoreProviders`.

---

### ✅ **Fix 2: Improve `displayProviders` fallback logic**

Update the `displayProviders` logic in your `HomeScreen`:

```ts
const displayProviders = useMemo(() => {
  console.log('Determining displayProviders. Nearby count:', nearbyProviders.length, 'Random count:', randomProviders.length);
  
  if (nearbyProviders.length > 0) return nearbyProviders;
  if (randomProviders.length > 0) return randomProviders;

  // Fallback in case both are empty
  return providers.slice(0, MAX_PROVIDERS_DISPLAY);
}, [nearbyProviders, randomProviders, providers]);
```

---

### ✅ **Fix 3: Prevent redundant `setProviders()` in enhanceWithReviews**

In `enhanceWithReviews` (inside `fetchProviders`), change this:

```ts
if (isMounted.current) {
  setProviders(prev => {
    const prevIds = prev.map(p => p.id).join(',');
    const newIds = sortedWithReviews.map(p => p.id).join(',');
    if (prevIds === newIds) return prev;
    return sortedWithReviews;
  });
}
```

This avoids unnecessary `useMemo` retriggers.

---

### ✅ **Fix 4: Prevent repeated fetches**

Just before `fetchProviders` runs:

```ts
const lastFetchTime = useRef(0);

const fetchProviders = useCallback(async () => {
  const now = Date.now();
  if (now - lastFetchTime.current < 2000) {
    console.log('Skipping fetchProviders, called too soon.');
    return;
  }
  lastFetchTime.current = now;
  
  //... rest of fetch logic
}, [profile?.id, location, calculateDistance]);
```

---

These changes will:

* **Stop the infinite loading loop**
* Ensure `displayProviders` always has fallback values
* Prevent unnecessary re-renders and race conditions

Would you like me to paste a full `fetchProviders()` refactor using all of this together?
