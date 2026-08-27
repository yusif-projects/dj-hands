/**
 * The Buy Me a Coffee button is injected by the vendor widget script in
 * `index.html`, so it lives outside React's tree. One delegated listener is
 * enough to report the click; the widget owns everything else.
 */
import { track } from './analytics'

export function trackSupportWidget(): void {
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
