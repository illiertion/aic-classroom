import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Logo } from "./components/Logo";
import { SecureContextNotice } from "./components/SecureContextNotice";
import { Spinner } from "./components/ui";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ClassroomConsole from "./pages/ClassroomConsole";
import Boards from "./pages/Boards";
import StudentJoin from "./pages/StudentJoin";
import StudentRoom from "./pages/StudentRoom";
import Guide from "./pages/Guide";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f6fb]">
      <Logo />
      <Spinner className="h-5 w-5 text-brand-600" />
      <p className="text-[13px] text-slate-500">수업 공간을 준비하는 중…</p>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { teacher, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!teacher) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route
            path="/app"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/app/classrooms/:id"
            element={
              <Protected>
                <ClassroomConsole />
              </Protected>
            }
          />
          <Route
            path="/app/guide"
            element={
              <Protected>
                <Guide />
              </Protected>
            }
          />
          <Route
            path="/app/boards"
            element={
              <Protected>
                <Boards />
              </Protected>
            }
          />
          <Route path="/join/:code" element={<StudentJoin />} />
          <Route path="/class/:code" element={<StudentRoom />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <SecureContextNotice />
      </BrowserRouter>
    </AuthProvider>
  );
}
