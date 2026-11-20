import { Navigate, Route } from "react-router-dom";
import { LEGACY_REDIRECTS } from "../../lib/routes";

/** One redirect route per old address; call inside <Routes>. */
export function legacyRouteElements() {
  return Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
    <Route key={from} path={from} element={<Navigate to={to} replace />} />
  ));
}
