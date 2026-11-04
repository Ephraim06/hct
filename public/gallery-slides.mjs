export function gallerySlides(grid){
 const items=Array.from(grid.querySelectorAll('.gallery-item')).filter(item=>!item.hidden);
 return {items,slides:items.map(item=>{const image=item.querySelector('img');return {src:image.currentSrc||image.src,width:Number(image.getAttribute('width'))||image.naturalWidth,height:Number(image.getAttribute('height'))||image.naturalHeight,alt:image.alt,element:item};})};
}
