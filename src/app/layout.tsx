import type { Metadata } from "next";
import { Orbitron, Nunito } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["700", "900"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pasas.mx",
  description: "Guías de estudio personalizadas para estudiantes mexicanos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <canvas
          id="starfield"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          (function () {
            var canvas = document.getElementById('starfield');
            var ctx = canvas.getContext('2d');
            var stars = [];
            var frame = 0;

            function initStars(oldW, oldH) {
              var w = canvas.width;
              var h = canvas.height;
              if (stars.length === 0) {
                for (var i = 0; i < 120; i++) {
                  stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    radius: 0.3 + Math.random() * 1.5,
                    baseOpacity: 0.1 + Math.random() * 0.7,
                    speed: 0.003 + Math.random() * 0.009,
                    offset: Math.random() * Math.PI * 2,
                  });
                }
              } else {
                for (var j = 0; j < stars.length; j++) {
                  stars[j].x = (stars[j].x / oldW) * w;
                  stars[j].y = (stars[j].y / oldH) * h;
                }
              }
            }

            function resize() {
              var oldW = canvas.width || window.innerWidth;
              var oldH = canvas.height || window.innerHeight;
              canvas.width = window.innerWidth;
              canvas.height = window.innerHeight;
              initStars(oldW, oldH);
            }

            function draw() {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                var opacity = s.baseOpacity + Math.sin(frame * s.speed + s.offset) * 0.3;
                if (opacity < 0) opacity = 0;
                if (opacity > 1) opacity = 1;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + opacity + ')';
                ctx.fill();
              }
              frame++;
              requestAnimationFrame(draw);
            }

            window.addEventListener('resize', resize);
            resize();
            draw();
          })();
        `}} />
      </body>
    </html>
  );
}
