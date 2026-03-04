import { ArrowLeft, Camera, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Scan = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col px-5 pt-14 pb-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-8">
        <ArrowLeft size={20} />
        <span className="text-[15px]">Back</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 rounded-3xl bg-card flex items-center justify-center" style={{ boxShadow: "var(--card-shadow)" }}>
          <Camera size={40} className="text-primary" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Scan Receipt</h1>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Take a photo of your receipt and AI will automatically extract the details
          </p>
        </div>

        <div className="flex gap-3 w-full max-w-xs">
          <Button className="flex-1 h-12 rounded-xl text-[15px] font-semibold gap-2">
            <Camera size={18} />
            Camera
          </Button>
          <Button variant="outline" className="flex-1 h-12 rounded-xl text-[15px] font-medium gap-2">
            <Image size={18} />
            Gallery
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Scan;
