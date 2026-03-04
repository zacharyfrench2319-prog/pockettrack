import { Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FloatingScanButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/scan")}
      className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg shadow-black/30 active:scale-95 transition-transform"
      aria-label="Scan receipt"
    >
      <Camera size={24} />
    </button>
  );
};

export default FloatingScanButton;
