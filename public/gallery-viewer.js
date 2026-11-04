import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import './gallery-viewer.css';
import {gallerySlides} from './gallery-slides.mjs';

const grid=document.getElementById('galleryGrid');
if(grid){
 const viewer=new PhotoSwipeLightbox({
  pswpModule:()=>import('photoswipe'),bgOpacity:.96,
  mainClass:'hct-photo-viewer',showHideAnimationType:'fade',
  closeTitle:'Close photo viewer',zoomTitle:'Zoom photo',
  arrowPrevTitle:'Previous photo',arrowNextTitle:'Next photo',
  errorMsg:'This photo could not be loaded. Please try again.',
 });
 viewer.init();
 grid.addEventListener('click',event=>{
  const item=event.target.closest('.gallery-item');if(!item)return;
  const {items,slides}=gallerySlides(grid),index=items.indexOf(item);
  if(index<0)return;
  event.preventDefault();viewer.loadAndOpen(index,slides);
 });
 const labelItems=()=>grid.querySelectorAll('.gallery-item').forEach(item=>item.setAttribute('aria-label',`View photo: ${item.querySelector('img')?.alt||'Tour photo'}`));
 labelItems();document.addEventListener('hct:gallery-added',labelItems);
}
