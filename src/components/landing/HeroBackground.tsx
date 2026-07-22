import { useEffect, useRef } from "react";
import { UtensilsCrossed, ChefHat, Coffee, Pizza, Soup, IceCream, Cookie } from "lucide-react";

const floatingIcons = [
  { Icon: UtensilsCrossed, delay: 0, x: 10, y: 20 },
  { Icon: ChefHat, delay: 1, x: 85, y: 15 },
  { Icon: Coffee, delay: 2, x: 20, y: 70 },
  { Icon: Pizza, delay: 0.5, x: 75, y: 65 },
  { Icon: Soup, delay: 1.5, x: 90, y: 40 },
  { Icon: IceCream, delay: 2.5, x: 5, y: 45 },
  { Icon: Cookie, delay: 3, x: 60, y: 85 },
];

export function HeroBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      };
    };

    const container = containerRef.current;
    container?.addEventListener("mousemove", handleMouseMove);
    return () => container?.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    let animationId: number;
    const icons = containerRef.current?.querySelectorAll(".floating-icon");

    const animate = () => {
      icons?.forEach((icon, index) => {
        const el = icon as HTMLElement;
        const depth = 0.5 + (index % 3) * 0.25;
        const offsetX = mouseRef.current.x * 30 * depth;
        const offsetY = mouseRef.current.y * 30 * depth;
        el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      });
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Flame gradient orbs — gold / orange / red */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
      <div className="absolute top-[60%] left-[20%] w-64 h-64 bg-destructive/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating icons */}
      {floatingIcons.map(({ Icon, delay, x, y }, index) => (
        <div
          key={index}
          className="floating-icon absolute transition-transform duration-300 ease-out"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            animation: `float ${4 + index * 0.5}s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        >
          <div className="p-3 rounded-xl bg-primary/5 backdrop-blur-sm border border-primary/10 shadow-lg">
            <Icon className="h-6 w-6 text-primary/40" />
          </div>
        </div>
      ))}

      {/* Decorative circles */}
      <svg className="absolute top-10 right-[15%] w-20 h-20 text-primary/10 animate-spin" style={{ animationDuration: "20s" }}>
        <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="8 4" />
      </svg>
      <svg className="absolute bottom-20 left-[10%] w-16 h-16 text-accent/15 animate-spin" style={{ animationDuration: "15s", animationDirection: "reverse" }}>
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="6 3" />
      </svg>

      {/* Dot pattern accents */}
      <div className="absolute top-[30%] right-[5%] grid grid-cols-3 gap-2 opacity-20">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
        ))}
      </div>
      <div className="absolute bottom-[25%] left-[8%] grid grid-cols-3 gap-2 opacity-15">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent" />
        ))}
      </div>
    </div>
  );
}
