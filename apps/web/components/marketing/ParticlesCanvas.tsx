'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

type Particle = {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  alpha: number
}

type ParticlesCanvasProps = {
  className?: string
  density?: number
}

export function ParticlesCanvas({ className, density = 0.00006 }: ParticlesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let width = 0
    let height = 0
    let particles: Particle[] = []
    let animationFrame = 0
    let color = 'rgba(15, 23, 42, 0.08)'

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      color = window.getComputedStyle(canvas).color || color

      const particleCount = Math.max(22, Math.floor(width * height * density))
      particles = Array.from({ length: particleCount }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.9 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        alpha: 0.3 + Math.random() * 0.5,
      }))
    }

    const render = () => {
      context.clearRect(0, 0, width, height)
      context.fillStyle = color

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > width) particle.vx *= -1
        if (particle.y < 0 || particle.y > height) particle.vy *= -1

        context.globalAlpha = particle.alpha
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fill()
      })

      context.globalAlpha = 1
      animationFrame = window.requestAnimationFrame(render)
    }

    resize()

    if (!prefersReducedMotion) {
      animationFrame = window.requestAnimationFrame(render)
    } else {
      render()
      window.cancelAnimationFrame(animationFrame)
    }

    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(animationFrame)
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 text-foreground/20', className)}
    />
  )
}
