/**
 * Closes a dropdown when the user clicks anywhere outside `target`. Scoping
 * `target` to just the trigger+panel pair (not a wider container) also gives
 * mutual exclusion between sibling dropdowns for free: clicking another
 * dropdown's trigger falls outside this one's root, so it closes here while
 * the other's own @click handler opens it.
 */
export function useClickOutside(target, onOutsideClick) {
  function handleClick(event) {
    const el = unref(target)
    if (el && !el.contains(event.target)) onOutsideClick(event)
  }

  onMounted(() => document.addEventListener('click', handleClick))
  onUnmounted(() => document.removeEventListener('click', handleClick))
}
