'use client'

import { useEffect, useRef } from 'react'

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let frame = 0

    const stars: { x: number; y: number; radius: number; baseOpacity: number; speed: number; offset: number }[] = []

    function initStars() {
      stars.length = 0
      for (let i = 0; i < 120; i++) {
        stars.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          radius: Math.random() * 1.5 + 0.3,
          baseOpacity: Math.random() * 0.5 + 0.1,
          speed: Math.random() * 0.012 + 0.003,
          offset: Math.random() * Math.PI * 2,
        })
      }
    }

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
      initStars()
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      for (const star of stars) {
        const opacity = Math.min(1, Math.max(0, star.baseOpacity + Math.sin(frame * star.speed + star.offset) * 0.3))
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx!.fill()
      }
      frame++
      animationId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
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
  )
}
