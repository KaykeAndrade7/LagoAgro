import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renderiza o titulo', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'LagoAgro' })).toBeInTheDocument()
  })
})
