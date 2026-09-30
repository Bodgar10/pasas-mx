import { describe, it, expect } from 'vitest'
import { detectarCanal } from '@/lib/arcade/canal'

/** s34-F2 — canal de la visita: utm → referrer → user agent → directo. */
const base = { search: '', referrer: '', userAgent: 'Mozilla/5.0 (iPhone) Safari', propioHost: 'pasas.mx' }

describe('detectarCanal', () => {
  it('utm_source manda y conserva utm', () => {
    expect(detectarCanal({ ...base, search: '?utm_source=ig&utm_campaign=prueba' })).toEqual({
      canal: 'instagram',
      utm_source: 'ig',
      utm_campaign: 'prueba',
    })
  })

  it('normaliza los alias de cada red', () => {
    expect(detectarCanal({ ...base, search: '?utm_source=fb' }).canal).toBe('facebook')
    expect(detectarCanal({ ...base, search: '?utm_source=wa' }).canal).toBe('whatsapp')
    expect(detectarCanal({ ...base, search: '?utm_source=tiktok' }).canal).toBe('tiktok')
    expect(detectarCanal({ ...base, search: '?utm_source=email' }).canal).toBe('email')
    expect(detectarCanal({ ...base, search: '?utm_source=boletin' }).canal).toBe('otro')
  })

  it('referrer externo: l.instagram.com es instagram (el caso que quedaba como "directo")', () => {
    expect(detectarCanal({ ...base, referrer: 'https://l.instagram.com/' }).canal).toBe('instagram')
    expect(detectarCanal({ ...base, referrer: 'https://lm.facebook.com/l.php' }).canal).toBe('facebook')
    expect(detectarCanal({ ...base, referrer: 'https://www.google.com.mx/' }).canal).toBe('google')
    expect(detectarCanal({ ...base, referrer: 'https://blog.ejemplo.mx/' }).canal).toBe('otro')
  })

  it('el referrer del mismo sitio no cuenta como externo', () => {
    expect(detectarCanal({ ...base, referrer: 'https://pasas.mx/' }).canal).toBe('directo')
  })

  it('navegador dentro de la app por user agent', () => {
    expect(detectarCanal({ ...base, userAgent: 'Mozilla/5.0 Instagram 300.0' }).canal).toBe('instagram')
    expect(detectarCanal({ ...base, userAgent: 'Mozilla/5.0 BytedanceWebview/d8a21c6' }).canal).toBe('tiktok')
    expect(detectarCanal({ ...base, userAgent: 'Mozilla/5.0 [FBAN/FBIOS;FBAV/400]' }).canal).toBe('facebook')
  })

  it('sin nada: directo', () => {
    expect(detectarCanal(base)).toEqual({ canal: 'directo', utm_source: null, utm_campaign: null })
  })
})
