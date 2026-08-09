import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ArticleImage } from '@/features/Articles/components/ArticleImage'

describe('ArticleImage', () => {
  it('renders the empty frame when the provider sent no picture', () => {
    const { container } = render(<ArticleImage src={undefined} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument()
  })

  it('falls back to the empty frame when the url 404s, rather than a broken icon', () => {
    const { container } = render(<ArticleImage src="https://e.test/gone.jpg" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument()
  })

  it('retries for a new src, so one bad url does not blank a recycled row', () => {
    const { container, rerender } = render(<ArticleImage src="https://e.test/gone.jpg" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()

    rerender(<ArticleImage src="https://e.test/good.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://e.test/good.jpg')
  })

  it('loads the hero eagerly and everything else lazily', () => {
    const { container, rerender } = render(<ArticleImage src="https://e.test/a.jpg" />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')

    rerender(<ArticleImage src="https://e.test/a.jpg" priority />)
    expect(container.querySelector('img')).toHaveAttribute('loading', 'eager')
  })

  it('keeps the same aspect frame whether or not there is a picture', () => {
    const { container: withImage } = render(<ArticleImage src="https://e.test/a.jpg" />)
    const { container: without } = render(<ArticleImage src={undefined} />)
    expect(withImage.firstElementChild).toHaveClass('aspect-video')
    expect(without.firstElementChild).toHaveClass('aspect-video')
  })
})
