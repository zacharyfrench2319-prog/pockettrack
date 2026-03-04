import { Camera, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const FloatingScanButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnScan = location.pathname === "/scan";

  return (
    <button
      onClick={() => isOnScan ? navigate(-1) : navigate("/scan")}
      className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg shadow-black/30 active:scale-95 transition-transform"
      aria-label={isOnScan ? "Close scan" : "Scan receipt"}
    >
      {isOnScan ? <X size={24} /> : <Camera size={24} />}
    </button>
  );
};

export default FloatingScanButton;
