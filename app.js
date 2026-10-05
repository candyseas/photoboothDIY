const $=id=>document.getElementById(id);
const video=$('video'), canvas=$('captureCanvas'), ctx=canvas.getContext('2d');
const welcome=$('welcomeScreen'), frameScreen=$('frameScreen'), boothScreen=$('boothScreen'), resultScreen=$('resultScreen');
const templateGrid=$('templateGrid'), photoCount=$('photoCount'), delay=$('delay'), cameraCard=$('cameraCard'), placeholder=$('cameraPlaceholder');
const countdownEl=$('countdown'), flash=$('flash'), statusEl=$('status'), progressText=$('progressText'), slotActionLabel=$('slotActionLabel'), stripPreview=$('stripPreview');
const slotUploadInput=$('slotUploadInput'), takeBtn=$('takePhotoBtn'), uploadBtn=$('uploadPhotoBtn'), switchBtn=$('switchCamera');
const resultImage=$('resultImage'), downloadBtn=$('downloadBtn'), retakeBtn=$('retakeBtn');

const TEMPLATES={
 classic:{name:'Classic Strip',desc:'Clean stacked photos',type:'classic',layouts:{3:{canvas:{width:900,height:2115},slots:[{x:60,y:90,width:780,height:585},{x:60,y:720,width:780,height:585},{x:60,y:1350,width:780,height:585}]},4:{canvas:{width:900,height:2745},slots:[{x:60,y:90,width:780,height:585},{x:60,y:720,width:780,height:585},{x:60,y:1350,width:780,height:585},{x:60,y:1980,width:780,height:585}]}}},
 square:{name:'Square Strip',desc:'Simple square photos',type:'square',layouts:{3:{canvas:{width:900,height:2670},slots:[{x:60,y:90,width:780,height:780},{x:60,y:960,width:780,height:780},{x:60,y:1830,width:780,height:780}]},4:{canvas:{width:900,height:3540},slots:[{x:60,y:90,width:780,height:780},{x:60,y:960,width:780,height:780},{x:60,y:1830,width:780,height:780},{x:60,y:2700,width:780,height:780}]}}},
 portrait:{name:'Portrait Strip',desc:'Tall portrait photos',type:'portrait',layouts:{3:{canvas:{width:900,height:3090},slots:[{x:90,y:90,width:720,height:960},{x:90,y:1110,width:720,height:960},{x:90,y:2130,width:720,height:960}]},4:{canvas:{width:900,height:4110},slots:[{x:90,y:90,width:720,height:960},{x:90,y:1110,width:720,height:960},{x:90,y:2130,width:720,height:960},{x:90,y:3150,width:720,height:960}]}}},
 mixed:{name:'Mixed Collage',desc:'Landscape + square photos',type:'mixed',layouts:{3:{canvas:{width:900,height:1530},slots:[{x:60,y:90,width:780,height:585},{x:60,y:705,width:375,height:375},{x:465,y:705,width:375,height:375}]}}}
};
let selectedTemplate='classic', stream=null, facingMode='user', activeSlot=0, shots=[], uploaded=[], lastResult=null, busy=false;

function template(){return TEMPLATES[selectedTemplate]}
function layout(){let t=template();let count=Number(photoCount.value);return t.layouts[count]||t.layouts[Object.keys(t.layouts)[0]]}
function ratio(slot){return slot.width/slot.height}
function setStatus(x){statusEl.textContent=x}
function show(screen){[welcome,frameScreen,boothScreen,resultScreen].forEach(s=>s.classList.add('hidden'));screen.classList.remove('hidden')}
function renderTemplates(){templateGrid.innerHTML='';Object.entries(TEMPLATES).forEach(([key,t])=>{let card=document.createElement('button');card.className='template-card'+(key===selectedTemplate?' selected':'');card.type='button';card.innerHTML=`<div class="mini-strip">${miniSlots(t.type,Number(photoCount.value))}</div><h3>${t.name}</h3><p>${t.desc}</p>`;card.onclick=()=>{selectedTemplate=key;if(!t.layouts[Number(photoCount.value)])photoCount.value=Object.keys(t.layouts)[0];renderTemplates()};templateGrid.appendChild(card)})}
function miniSlots(type,count){let arr=[];for(let i=0;i<count;i++){let c='mini-slot';if(type==='square')c+=' mini-square';if(type==='portrait')c+=' mini-portrait';if(type==='mixed')c+=' mini-mixed';arr.push(`<div class="${c}"></div>`)}return arr.join('')}
photoCount.addEventListener('change',renderTemplates);

function renderStrip(){stripPreview.innerHTML='';layout().slots.forEach((slot,i)=>{let d=document.createElement('div');d.className='preview-slot'+(i===activeSlot?' active':'')+(shots[i]||uploaded[i]?'':' empty');d.dataset.label=`PHOTO ${i+1}`;d.style.aspectRatio=`${slot.width}/${slot.height}`;if(shots[i]||uploaded[i]){let img=document.createElement('img');img.src=shots[i]||uploaded[i];d.appendChild(img)}d.onclick=()=>selectSlot(i);stripPreview.appendChild(d)})}
function selectSlot(i,force=false){if(busy&&!force)return;activeSlot=i;updateFrame();renderStrip();setStatus(shots[i]||uploaded[i]?'Photo ready • Retake or replace it':'Ready for Photo '+(i+1));}
function updateFrame(){let slot=layout().slots[activeSlot];cameraCard.style.aspectRatio=`${slot.width}/${slot.height}`;progressText.textContent=`PHOTO ${activeSlot+1} OF ${layout().slots.length}`;slotActionLabel.textContent=`PHOTO ${activeSlot+1} • ${Math.round(ratio(slot)*100)/100===1?'1:1':ratio(slot)>1?'4:3':'3:4'}`}
async function startCamera(){if(stream)stream.getTracks().forEach(t=>t.stop());try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1280},height:{ideal:1280}},audio:false});video.srcObject=stream;placeholder.classList.add('hidden');setStatus('Camera ready');switchBtn.disabled=false}catch(e){stream=null;placeholder.classList.remove('hidden');setStatus('Camera unavailable. You can upload a photo instead.');}}
function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}video.srcObject=null}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
async function countdown(sec){for(let n=sec;n>0;n--){countdownEl.textContent=n;await wait(1000)}countdownEl.textContent='';}
function crop(sourceW,sourceH,targetW,targetH){let sr=sourceW/sourceH,tr=targetW/targetH,sw,sh,sx,sy;if(sr>tr){sh=sourceH;sw=sh*tr;sx=(sourceW-sw)/2;sy=0}else{sw=sourceW;sh=sw/tr;sx=0;sy=(sourceH-sh)/2}return{sx,sy,sw,sh}}
function captureFrame(slot){if(!stream||video.readyState<2)throw new Error('Camera is not ready.');let w=slot.width,h=slot.height;canvas.width=w;canvas.height=h;let c=crop(video.videoWidth,video.videoHeight,w,h);ctx.save();if(facingMode==='user'){ctx.translate(w,0);ctx.scale(-1,1)}ctx.drawImage(video,c.sx,c.sy,c.sw,c.sh,0,0,w,h);ctx.restore();flash.classList.remove('active');void flash.offsetWidth;flash.classList.add('active');return canvas.toDataURL('image/jpeg',.92)}
function readFile(file){return new Promise((resolve,reject)=>{let r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function chooseUpload(){slotUploadInput.value='';slotUploadInput.click()}
slotUploadInput.addEventListener('change',async e=>{let f=e.target.files?.[0];if(!f)return;try{uploaded[activeSlot]=await readFile(f);shots[activeSlot]=null;renderStrip();setStatus(`Photo ${activeSlot+1} uploaded`);if(activeSlot<layout().slots.length-1){setTimeout(()=>selectSlot(activeSlot+1),350)}else{await wait(250);await finishSession()}}catch(err){console.error(err);setStatus('Could not read that image.')}})

async function takePhoto(){if(busy)return;busy=true;takeBtn.disabled=true;uploadBtn.disabled=true;try{if(!stream)await startCamera();if(!stream)throw new Error('Camera unavailable. Use Upload Photo instead.');let sec=Number(delay.value);setStatus(`Get ready for Photo ${activeSlot+1}`);await countdown(sec);let data=captureFrame(layout().slots[activeSlot]);shots[activeSlot]=data;uploaded[activeSlot]=null;renderStrip();setStatus(`Photo ${activeSlot+1} captured`);if(activeSlot<layout().slots.length-1){await wait(450);selectSlot(activeSlot+1,true)}else{await wait(250);await finishSession()}}catch(e){setStatus(e.message||'Capture failed.')}finally{busy=false;takeBtn.disabled=false;uploadBtn.disabled=false}}

takeBtn.addEventListener('click',takePhoto);uploadBtn.addEventListener('click',chooseUpload);
switchBtn.addEventListener('click',async()=>{facingMode=facingMode==='user'?'environment':'user';await startCamera()});

function drawCover(c,img,slot){let s=crop(img.naturalWidth||img.width,img.naturalHeight||img.height,slot.width,slot.height);c.drawImage(img,s.sx,s.sy,s.sw,s.sh,slot.x,slot.y,slot.width,slot.height)}
function loadImage(src){return new Promise((resolve,reject)=>{let i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src})}
async function buildFinal(){let l=layout(),c=document.createElement('canvas');c.width=l.canvas.width;c.height=l.canvas.height;let x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);for(let i=0;i<l.slots.length;i++){let src=shots[i]||uploaded[i];if(!src)continue;let img=await loadImage(src);drawCover(x,img,l.slots[i])}return c.toDataURL('image/png')}
async function finishSession(){if(busy&&document.body.dataset.building==='1')return;document.body.dataset.building='1';busy=true;takeBtn.disabled=true;uploadBtn.disabled=true;setStatus('Building your strip…');try{lastResult=await buildFinal();resultImage.src=lastResult;stopCamera();show(resultScreen);setStatus('Your strip is ready!')}catch(e){console.error(e);setStatus('Could not build the strip.')}finally{document.body.dataset.building='0';busy=false;takeBtn.disabled=false;uploadBtn.disabled=false}}

$('startSessionBtn').onclick=()=>{renderTemplates();show(frameScreen)};
$('continueFrameBtn').onclick=async()=>{let l=layout();shots=new Array(l.slots.length).fill(null);uploaded=new Array(l.slots.length).fill(null);activeSlot=0;renderStrip();updateFrame();show(boothScreen);await startCamera()};
$('backToFrames').onclick=()=>{stopCamera();show(frameScreen)};
retakeBtn.onclick=()=>{stopCamera();show(welcome);renderTemplates()};
downloadBtn.onclick=()=>{if(!lastResult)return;let a=document.createElement('a');a.href=lastResult;a.download=`photobooth-${Date.now()}.png`;a.click()};

renderTemplates();
