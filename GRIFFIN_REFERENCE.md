# Griffin appearance reference

Approved by Justin on November 11, 2026. This appearance supersedes the earlier puppy-like Griffin artwork for all current Doodle Onward portraits, animation poses, icons, and future character assets.

- [Approved master character sheet](https://chatgpt.com/library?file_id=libfile_fde3_f-2981b4efca9c8191b9a586bd497e0003_f0f37799c2908191aab218bcd636ebbe&account_id=personal)
- [Complete character guide and photo/video references](https://chatgpt.com/library?file_id=libfile_fde3_f-a1bb25edc92c8191a821e948753f38d5_f0f37799c2908191aab218bcd636ebbe&account_id=personal)

## Required likeness

Griffin is Justin's mature male black-and-white Bernedoodle. Keep the established BoerneDoodle name in this game. He is sturdy and sweet, with a goofy, trusting, snack-loving good-boy personality.

Preserve his broad white crown tuft narrowing into a slim central forehead blaze; black eye surrounds and long drooping black ears; warm dark brown eyes; broad fluffy white muzzle with gray immediately around his large black nose; white chin; prominent white chest bib; white nape patch; mostly black legs with small white toe tips; and raised curved black tail with a fluffy white tip. His body is neatly clipped and curly, with a fuller head, muzzle, ears, and tail. Warm highlights in illustrations are lighting, not brown or tan coat markings. Do not add tan eyebrows, tall white socks, a narrow poodle muzzle, oversized puppy eyes, or an unrequested collar.

The approved illustration establishes the current clean hand-drawn style. The supplied photos and videos establish actual anatomy and grooming. Justin's later explicit instructions take precedence over this guide.

## Current assets and consumers

| Asset | Use |
| --- | --- |
| `dist/assets/griffin-character-atlas.png` | Four approved Griffin poses: two running strides, one jump, one seated portrait. All current hero previews, crew selectors, campsite portraits, and runner drawing use this atlas through `CHARACTER_ART.griffin`. |
| `dist/assets/griffin-icon.png` | Updated browser, installation, and Home Screen icon. Versioned asset URL in the HTML, manifest, and service worker refreshes browser caches. |

The original `griffin-atlas.png` composite is retained solely for its obstacle and snack props in cells 4–8. Its obsolete dog cells 0–3 are blocked by the prop renderer and must never be used as Griffin references or a fallback. The new character atlas has measured regions in `CHARACTER_ART.griffin.regions` to keep all poses isolated and preserve their transparent margins.

Appearance updates must preserve character IDs, gameplay values, saved-game keys, the other family characters, and the site's existing audience. Keep these implementation notes outside the player interface.
