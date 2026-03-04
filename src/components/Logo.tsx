const Logo = ({ size = "default" }: { size?: "default" | "large" }) => {
  const textSize = size === "large" ? "text-3xl" : "text-xl";
  return (
    <h1 className={`${textSize} font-bold tracking-tight`}>
      <span className="text-foreground">Pocket</span>
      <span className="text-primary">Track</span>
    </h1>
  );
};

export default Logo;
