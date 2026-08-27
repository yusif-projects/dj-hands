/**
 * The Buy Me a Coffee button is injected by the vendor widget script in
 * `index.html`, so everything it renders lives outside React's tree and has to
 * be handled from the outside.
 */
import { track } from './analytics'

const WIDGET_SELECTOR = 'script[data-name="BMC-Widget"]'
const BUBBLE_CLASS = 'bmc-message'

export function initSupportWidget(): void {
  trackClicks()
  tagMessageBubble()
}

/** One delegated listener; the widget owns the click itself. */
function trackClicks(): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (target instanceof Element && target.closest('#bmc-wbtn')) {
        track('support_click', { placement: 'widget' })
      }
    },
    true,
  )
}

/**
 * The widget gives its message bubble no id or class, and pins it to the bottom
 * of the viewport — stranding it away from the button, which we move to the top
 * in `styles.css`. Tag it by the text the snippet asked for so CSS can reach it.
 */
function tagMessageBubble(): void {
  const script = document.querySelector<HTMLScriptElement>(WIDGET_SELECTOR)
  const message = script?.dataset.message?.trim()
  if (!message) return

  const find = () =>
    Array.from(document.body.children).find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.textContent?.trim() === message,
    )

  const tag = (el: HTMLElement) => el.classList.add(BUBBLE_CLASS)

  const existing = find()
  if (existing) {
    tag(existing)
    return
  }

  // The script appends on its own schedule, and may never run at all if the CDN
  // is blocked — so watch for a while, then give up rather than observe forever.
  const observer = new MutationObserver(() => {
    const el = find()
    if (!el) return
    tag(el)
    observer.disconnect()
  })
  observer.observe(document.body, { childList: true })
  setTimeout(() => observer.disconnect(), 10_000)
}
