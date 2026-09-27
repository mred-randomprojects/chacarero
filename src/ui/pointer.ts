/**
 * Whether this screen is driven by touch (a phone or a tablet): no hover, so
 * hints say "tocá" instead of "pasá el mouse", and the key badges are hidden
 * (the same media query hides them in the stylesheet).
 */
export const touchScreen: boolean = typeof matchMedia !== "undefined" && matchMedia("(hover: none)").matches;
