import { useEffect, useState } from "react";

/** Returns true only after the component has hydrated on the client.
 *  Use to gate any UI that depends on Date.now() or other client-only data
 *  to avoid SSR/hydration mismatches (React error #418). */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m;
}
