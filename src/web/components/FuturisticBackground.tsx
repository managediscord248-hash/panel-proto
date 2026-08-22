import { useEffect, useRef, useState } from "react";

interface Particle {
  left: number;
  size: number;
  duration: number;
  delay: number;
}

export function FuturisticBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    if (!mq.matches) {
      const count = window.innerWidth < 768 ? 12 : 25;
      const parts: Particle[] = Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 10,
      }));
      setParticles(parts);
    }

    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
    };
    window.addEventListener("mousemove", onMove);

    const shapes: { x: number; y: number; z: number; rot: number; size: number; speed: number }[] = [];
    const count = window.innerWidth < 768 ? 6 : 12;
    for (let i = 0; i < count; i++) {
      shapes.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.5 + 0.5,
        rot: Math.random() * Math.PI * 2,
        size: Math.random() * 40 + 20,
        speed: Math.random() * 0.0003 + 0.0001,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const glow = getComputedStyle(document.documentElement).getPropertyValue("--az-glow").trim() || "191, 0, 255";

      for (const s of shapes) {
        s.rot += s.speed;
        const parX = (mouseX - 0.5) * 30 * s.z;
        const parY = (mouseY - 0.5) * 30 * s.z;
        const x = s.x * canvas.width + parX;
        const y = s.y * canvas.height + parY;
        const size = s.size * s.z;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(s.rot);
        ctx.strokeStyle = `rgba(${glow}, ${0.08 * s.z})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = `rgba(${glow}, ${0.02 * s.z})`;
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [reducedMotion]);

  return (
    <div className="futuristic-bg">
      <div className="bg-grid" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {!reducedMotion && (
        <>
          <div
            className="bg-orb"
            style={{
              width: "300px",
              height: "300px",
              top: "10%",
              left: "15%",
              background: "rgba(var(--az-glow), 0.06)",
              animationDuration: "12s",
            }}
          />
          <div
            className="bg-orb"
            style={{
              width: "400px",
              height: "400px",
              bottom: "5%",
              right: "10%",
              background: "rgba(var(--az-glow), 0.04)",
              animationDuration: "15s",
              animationDelay: "2s",
            }}
          />
          {particles.map((p, i) => (
            <div
              key={i}
              className="bg-particle"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
