import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Moon, Sun, ChevronRight, Bell, Shield, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

const Profile = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const dark = document.documentElement.classList.contains("dark");
    setIsDark(dark);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email || "");
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const menuItems = [
    { icon: isDark ? Sun : Moon, label: isDark ? "Light Mode" : "Dark Mode", action: toggleTheme },
    { icon: Bell, label: "Notifications", action: () => {} },
    { icon: Shield, label: "Privacy & Security", action: () => {} },
    { icon: HelpCircle, label: "Help & Support", action: () => {} },
  ];

  return (
    <div className="px-5 pt-14 pb-4 space-y-4">
      <h1 className="text-[28px] font-bold text-foreground">Profile</h1>

      {/* User Card */}
      <div className="rounded-2xl bg-card p-5 flex items-center gap-4" style={{ boxShadow: "var(--card-shadow)" }}>
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">
            {email ? email[0].toUpperCase() : "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">{email}</p>
          <p className="text-xs text-muted-foreground">Free Plan</p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="rounded-2xl bg-card overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <item.icon size={20} className="text-muted-foreground" />
            <span className="flex-1 text-[15px] text-foreground text-left">{item.label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <Button
        variant="ghost"
        onClick={handleLogout}
        className="w-full h-12 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10 text-[15px] font-medium gap-2"
      >
        <LogOut size={18} />
        Sign Out
      </Button>

      <div className="flex justify-center pt-4">
        <Logo />
      </div>
    </div>
  );
};

export default Profile;
