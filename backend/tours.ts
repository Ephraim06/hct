/** Canonical tour identifiers; requests cannot supply arbitrary titles or destinations. */
export const tours = [
 {slug:'cape-point-penguins',title:'Cape of Good Hope & Penguins',href:'cape-point-penguins.html',image:'images/optimized/simons-town-penguins-960.webp'},
 {slug:'cape-point-penguins-private-tour',title:'Private Cape Point & Penguins',href:'cape-point-penguins-private-tour.html',image:'images/optimized/boulders-beach-penguins-960.webp'},
 {slug:'cape-agulhas',title:'Cape Agulhas',href:'cape-agulhas.html',image:'images/optimized/cape-agulhas-960.webp'},
 {slug:'chapmans-peak',title:'Chapman’s Peak',href:'chapmans-peak.html',image:'images/optimized/chapmans-peak-960.webp'},
 {slug:'capewinelands-stellenbosch',title:'Cape Winelands',href:'capewinelands-stellenbosch.html',image:'images/optimized/cape-winelands-960.webp'},
 {slug:'robben-island',title:'Robben Island & Township',href:'robben-island.html',image:'images/optimized/robben-island-960.webp'},
 {slug:'safari-day-tour',title:'Safari Day Tour',href:'safari-day-tour.html',image:'images/optimized/safari-day-tour-960.webp'},
 {slug:'whale-watching',title:'Whale Watching Hermanus',href:'whale-watching.html',image:'images/optimized/whale-960.webp'},
] as const;
export const findTour=(slug:string)=>tours.find(tour=>tour.slug===slug);
