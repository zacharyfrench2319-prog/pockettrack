import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import FloatingScanButton from "./FloatingScanButton";
import AuthGuard from "./AuthGuard";

const AppLayout = () => {
  return (
    <AuthGuard>
      <div className="min-h-screen pb-16">
        <Outlet />
        <BottomNav />
        <FloatingScanButton />
      </div>
    </AuthGuard>
  );
};

export default AppLayout;
