import {
  AccountPage,
  AuthPage,
  CreateUserPage,
  HistoryPage,
  HomePage,
  KnotsPage,
  KnotStatsPage,
  Loading,
  PrivateRoute,
  RecordPage,
  useAuth,
} from "./components/index.js";
import { Navigate, useLocation } from "./ui/index.js";

export default function App() {
  const { ready } = useAuth();
  const { pathname } = useLocation();
  if (!ready) return <Loading />;

  if (pathname === "/login") return <AuthPage />;
  if (pathname === "/create-user") return <CreateUserPage />;
  if (pathname === "/") return <PrivateRoute><HomePage /></PrivateRoute>;
  if (pathname === "/record") return <PrivateRoute><RecordPage /></PrivateRoute>;
  if (pathname === "/knots") return <PrivateRoute><KnotsPage /></PrivateRoute>;
  const knotStatsMatch = pathname.match(/^\/knots\/(\d+)$/);
  if (knotStatsMatch) {
    return (
      <PrivateRoute>
        <KnotStatsPage nameId={Number(knotStatsMatch[1])} />
      </PrivateRoute>
    );
  }
  if (pathname === "/history") return <PrivateRoute><HistoryPage /></PrivateRoute>;
  if (pathname === "/account") return <PrivateRoute><AccountPage /></PrivateRoute>;
  return <Navigate to="/" replace />;
}
