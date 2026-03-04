import { Home, BarChart3, Target, User, Camera, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/home", label: "Home", icon: Home },
  { path: "/spending", label: "Spending", icon: BarChart3 },
  // scan button goes here (rendered separately)
  { path: "/goals", label: "Goals", icon: Target },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isOnScan = location.pathname === "/scan";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-14 glass-nav bg-card/85 dark:bg-[rgba(28,28,33,0.85)] border-t border-[rgba(255,255,255,0.05)]">
      <div className="flex h-full items-center justify-around px-3 max-w-md mx-auto relative">
        {/* First two tabs */}
        {tabs.slice(0, 2).map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? "text-primary bg-primary/12"
                  : "text-muted-foreground"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}

        {/* Centre scan button */}
        <button
          onClick={() => isOnScan ? navigate(-1) : navigate("/scan")}
          className="flex flex-col items-center justify-center -mt-7"
          aria-label={isOnScan ? "Close scan" : "Scan"}
        >
          <div className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg shadow-black/30 active:scale-95 transition-transform">
            {isOnScan ? <X size={24} /> : <Camera size={24} />}
          </div>
        </button>

        {/* Last two tabs */}
        {tabs.slice(2).map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? "text-primary bg-primary/12"
                  : "text-muted-foreground"
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
