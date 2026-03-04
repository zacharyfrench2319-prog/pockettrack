import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import AuthGuard from "./AuthGuard";

const AppLayout = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen pb-16">
        <Outlet />
        <BottomNav />
      </div>
    </AuthGuard>
  );
};

export default AppLayout;
