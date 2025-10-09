export function truncateAddress(address: string, left = 4, right = 4) {
  if (!address) return ''
  return address.length > left + right
    ? `${address.slice(0, left)}…${address.slice(-right)}`
    : address
}
