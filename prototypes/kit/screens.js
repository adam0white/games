// Full-page cards (menu, shop, paused). Each is an element with an id; the one showing has class "on".
//   const show = screens(['menu', 'shop', 'paused'], name => { per-game work after a switch });
//   show('shop'); show('play')   a name not in the list hides every card
export function screens(ids, after = null) {
  return name => { for (const id of ids) document.getElementById(id).classList.toggle('on', id === name); after?.(name); };
}
