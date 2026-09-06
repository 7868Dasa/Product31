import { useState, useEffect, useCallback } from 'react';
import { api, auth } from './api.js';

/**
 * Session hook. On mount, if we have a refresh token, try to establish a
 * session and load the current user.
 */
export function useSession() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const { user } = await api('/auth/me', { authed: true });
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (auth.refreshToken && !auth.accessToken) {
        // prime an access token via refresh, then load /me
        await api('/auth/refresh', { method: 'POST', body: { refresh_token: auth.refreshToken } })
          .then((d) => auth.set(d))
          .catch(() => auth.clear());
      }
      if (alive) {
        if (auth.accessToken) await loadMe();
        setLoading(false);
      }
    })();
    return auth.onChange(() => {
      if (!auth.accessToken && !auth.refreshToken) setUser(null);
    });
  }, [loadMe]);

  const signOut = useCallback(async () => {
    const rt = auth.refreshToken;
    if (rt) await api('/auth/logout', { method: 'POST', body: { refresh_token: rt } }).catch(() => {});
    auth.clear();
    setUser(null);
  }, []);

  return { user, setUser, loading, signOut, reloadUser: loadMe };
}
