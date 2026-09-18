
(() => {
  'use strict';

  const IMAGE_QUALITY=64;
  function sourceImageUrl(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      const u=new URL(raw,location.href);
      if(u.hostname==='wsrv.nl'||u.hostname==='images.weserv.nl'){
        let src=u.searchParams.get('url')||'';
        if(src&&!/^https?:\/\//i.test(src))src='https://'+src;
        return src||raw;
      }
    }catch(_){}
    return raw;
  }
  function optimizeImageUrl(value,width=0){
    const raw=String(value||'').trim();
    if(!raw)return '';
    try{
      let u=new URL(raw,location.href);
      if(u.hostname==='wsrv.nl'||u.hostname==='images.weserv.nl'){
        u.protocol='https:';
        u.hostname='wsrv.nl';
        u.searchParams.set('output','webp');
        u.searchParams.set('q',String(IMAGE_QUALITY));
        if(width>0)u.searchParams.set('w',String(width));
        return u.toString();
      }
      if(u.hostname==='i.ibb.co'||u.hostname==='ibb.co'||u.hostname==='www.ibb.co'){
        const proxy=new URL('https://wsrv.nl/');
        proxy.searchParams.set('url',u.href);
        proxy.searchParams.set('output','webp');
        proxy.searchParams.set('q',String(IMAGE_QUALITY));
        if(width>0)proxy.searchParams.set('w',String(width));
        return proxy.toString();
      }
    }catch(_){}
    return raw;
  }

  const CATEGORIES={
    downlights:{label:'Down Lights',file:'./data/downlights.csv'},
    tracklights:{label:'Track Lights',file:'./data/tracklights.csv'},
    profiles:{label:'Profiles',file:'./data/profiles.csv'},
    outdoor:{label:'Outdoor Lights',file:'./data/outdoor-lights.csv'}
  };
  let activeCategory='downlights';
  const DESKTOP_PAGE_SIZE=12;
  function getPageSize(){
    return window.matchMedia('(max-width:780px)').matches ? Number.MAX_SAFE_INTEGER : DESKTOP_PAGE_SIZE;
  }
  let records=[],groups=[],viewGroups=[],currentPage=0,activeGroup=null,activeFinish='',activeImage='';
  const cardFinishSelections=new Map();
  const profileVariationSelections=new Map();
  const state={q:'',name:'',cct:'',wattage:'',itemNo:'',vf:'',imax:'',cri:'',cutout:'',beam:'',batchCode:'',stockCode:'',bisNo:'',bisSpec:'',mrp:'',mfgBy:'',finish:''};
  const globalCatalogueCache={};
  let globalCataloguePromise=null;
  let globalSearchResults=[];
  let globalSearchToken=0;
  let globalSearchTimer=null;
  const $=id=>document.getElementById(id);
  const els={csvInput:$('csvInput'),status:$('status'),searchBox:$('searchBox'),nameFilter:$('nameFilter'),cctFilter:$('cctFilter'),wattageFilter:$('wattageFilter'),itemNoFilter:$('itemNoFilter'),vfFilter:$('vfFilter'),imaxFilter:$('imaxFilter'),criFilter:$('criFilter'),cutoutFilter:$('cutoutFilter'),beamFilter:$('beamFilter'),batchCodeFilter:$('batchCodeFilter'),stockCodeFilter:$('stockCodeFilter'),bisNoFilter:$('bisNoFilter'),bisSpecFilter:$('bisSpecFilter'),mrpFilter:$('mrpFilter'),mfgByFilter:$('mfgByFilter'),moreBtn:$('moreBtn'),advancedFilters:$('advancedFilters'),resetBtn:$('resetBtn'),finishChips:$('finishChips'),activeFilters:$('activeFilters'),grid:$('grid'),catalogueCount:$('catalogueCount'),pagination:$('pagination'),prevBtn:$('prevBtn'),nextBtn:$('nextBtn'),pageInfo:$('pageInfo'),modal:$('modal'),closeBtn:$('closeBtn'),detailImage:$('detailImage'),detailFinishOptions:$('detailFinishOptions'),thumbs:$('thumbs'),finishNote:$('finishNote'),detailKicker:$('detailKicker'),detailTitle:$('detailTitle'),detailSub:$('detailSub'),specGrid:$('specGrid'),variantBody:$('variantBody'),variantFilterNote:$('variantFilterNote'),categoryTabs:$('categoryTabs'),categoryTitle:$('categoryTitle')};

  const headerAliases={
    name:['name','product name','product'],itemNo:['item no','item number','itemno','item code'],vf:['vf','voltage'],imax:['imax','current','max current'],cct:['cct','colour temperature','color temperature'],cri:['cri'],cutout:['cutout','cut out','cut-out'],beam:['beam angle','beam','beamangle'],wattage:['wattage','watt','watts','power'],batchCode:['batch code','batch','batchcode'],stockCode:['stock code','stock','stockcode','sku'],bisNo:['bis no','bis number','bisno','bis registration no','bis registration number'],bisSpec:['bis sec','bissec','bis spec','bis specification','bisspec','bis standard','is standard'],mrp:['mrp','maximum retail price','retail price','price'],mfgBy:['mfg by','mfgby','manufacturer','manufactured by','manufacturing by','manufacturer name'],newDescription:['new description','newdescription','description','product description'],image:['image','image url','image link','imageurl'],finish:['finish','colour','color','finish colour','finish color']
  };
  const finishCodeMap={W:'White',B:'Mat Black',CG:'Champagne Gold',RG:'Rose Gold',BR:'Brown',COF:'Coffee',DGR:'Dark Gray',BB:'Ballet Blue',CH:'Chrome',CHB:'Chrome Black'};
  const finishOrder=['White','Mat Black','Champagne Gold','Rose Gold','Brown','Coffee','Dark Gray','Ballet Blue','Chrome','Chrome Black','Standard'];
  const finishClassMap={'White':'sw-white','Mat Black':'sw-mat-black','Champagne Gold':'sw-champagne-gold','Rose Gold':'sw-rose-gold','Brown':'sw-brown','Coffee':'sw-coffee','Dark Gray':'sw-dark-gray','Ballet Blue':'sw-ballet-blue','Chrome':'sw-chrome','Chrome Black':'sw-chrome-black','Standard':'sw-standard'};
  const filterFields=['name','cct','wattage','itemNo','vf','imax','cri','cutout','beam','batchCode','stockCode','bisNo','bisSpec','mrp','mfgBy'];
  const filterEls={name:els.nameFilter,cct:els.cctFilter,wattage:els.wattageFilter,itemNo:els.itemNoFilter,vf:els.vfFilter,imax:els.imaxFilter,cri:els.criFilter,cutout:els.cutoutFilter,beam:els.beamFilter,batchCode:els.batchCodeFilter,stockCode:els.stockCodeFilter,bisNo:els.bisNoFilter,bisSpec:els.bisSpecFilter,mrp:els.mrpFilter,mfgBy:els.mfgByFilter};
  const filterLabels={name:'Product',cct:'CCT',wattage:'Wattage',itemNo:'Item No.',vf:'Vf',imax:'Imax',cri:'CRI',cutout:'Cutout',beam:'Beam',batchCode:'Batch',stockCode:'Stock Code',bisNo:'BIS No',bisSpec:'BIS SEC',mrp:'MRP',mfgBy:'MFG BY',finish:'Finish'};
  const optionLabels={name:'All products',cct:'All CCT',wattage:'All wattages',itemNo:'All item nos.',vf:'All Vf',imax:'All Imax',cri:'All CRI',cutout:'All cutouts',beam:'All beam angles',batchCode:'All batch codes',stockCode:'All stock codes',bisNo:'All BIS nos.',bisSpec:'All BIS SEC',mrp:'All MRP',mfgBy:'All manufacturers'};

  function cleanKey(s){return String(s??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ')}
  function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}
  function unique(arr){return [...new Set(arr.map(v=>String(v??'').trim()).filter(Boolean))]}
  function naturalSort(a,b){return String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})}
  function numericSort(a,b){const na=parseFloat(String(a).replace(/[^0-9.]+/g,'')),nb=parseFloat(String(b).replace(/[^0-9.]+/g,''));if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb)return na-nb;return naturalSort(a,b)}
  function swatchClass(f){return finishClassMap[f]||'sw-standard'}
  function swatchHtml(f,all=false){return `<span class="swatch ${all?'all':swatchClass(f)}" aria-hidden="true"></span>`}

  function detectDelimiter(text){
    const first=String(text??'').replace(/^\uFEFF/,'').split(/\r?\n/).find(l=>l.trim())||'';let quoted=false,counts={',':0,';':0,'\t':0};
    for(let i=0;i<first.length;i++){const ch=first[i];if(ch==='"'){if(quoted&&first[i+1]==='"'){i++;continue}quoted=!quoted;continue}if(!quoted&&Object.prototype.hasOwnProperty.call(counts,ch))counts[ch]++}
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  }
  function parseCSV(text){
    text=String(text??'').replace(/^\uFEFF/,'');const delimiter=detectDelimiter(text),rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"'){quoted=false}else cell+=ch}else{if(ch==='"')quoted=true;else if(ch===delimiter){row.push(cell);cell=''}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(ch!=='\r')cell+=ch}}
    if(cell.length||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(v=>String(v).trim()!==''));
  }
  function normalizeFinishText(value){
    const x=cleanKey(value).replace(/\bdefault\b/g,'').trim();if(!x)return '';
    const map={white:'White',w:'White',black:'Mat Black','mat black':'Mat Black','matte black':'Mat Black',b:'Mat Black','champagne gold':'Champagne Gold','champeing gold':'Champagne Gold','champeign gold':'Champagne Gold','champain gold':'Champagne Gold',cg:'Champagne Gold','rose gold':'Rose Gold',rg:'Rose Gold',brown:'Brown',br:'Brown',coffee:'Coffee',cofee:'Coffee',cof:'Coffee','dark gray':'Dark Gray','dark grey':'Dark Gray',dgr:'Dark Gray','ballet blue':'Ballet Blue',bb:'Ballet Blue',chrome:'Chrome',crome:'Chrome',ch:'Chrome','chrome black':'Chrome Black','crome black':'Chrome Black',chb:'Chrome Black'};
    return map[x]||String(value).trim();
  }
  function inferFinish(rec){
    const code=String(rec.stockCode||'').trim().toUpperCase();const suffix=code.split('/').filter(Boolean).pop()||'';if(finishCodeMap[suffix])return finishCodeMap[suffix];
    const img=decodeURIComponent(sourceImageUrl(rec.image)).toLowerCase().replace(/[_]+/g,'-');
    const tests=[[/chrome[- ]?black|crome[- ]?black/,'Chrome Black'],[/champagne[- ]?gold|champeing[- ]?gold|champeign[- ]?gold/,'Champagne Gold'],[/rose[- ]?gold/,'Rose Gold'],[/ballet[- ]?blue/,'Ballet Blue'],[/dark[- ]?gr(?:a|e)y/,'Dark Gray'],[/coffee|cofee/,'Coffee'],[/brown/,'Brown'],[/chrome|crome/,'Chrome'],[/mat[- ]?black|matte[- ]?black|black|balck/,'Mat Black'],[/white/,'White']];
    for(const [re,label] of tests)if(re.test(img))return label;return 'Standard';
  }
  function normalizeRows(rows){
    if(rows.length<2)return[];const headers=rows[0].map(h=>String(h).trim()),headerMap={};headers.forEach((h,i)=>headerMap[cleanKey(h)]=i);
    const indexOf=field=>{for(const a of headerAliases[field]||[]){const k=cleanKey(a);if(k in headerMap)return headerMap[k]}return-1};const idx={};Object.keys(headerAliases).forEach(k=>idx[k]=indexOf(k));if(idx.name<0)throw new Error('CSV must contain a “Name” column.');
    return rows.slice(1).map((r,i)=>{const get=k=>idx[k]>=0?String(r[idx[k]]??'').trim():'';const rec={_row:i+2,name:get('name'),itemNo:get('itemNo'),vf:get('vf'),imax:get('imax'),cct:get('cct'),cri:get('cri'),cutout:get('cutout'),beam:get('beam'),wattage:get('wattage'),batchCode:get('batchCode'),stockCode:get('stockCode'),bisNo:get('bisNo'),bisSpec:get('bisSpec'),mrp:get('mrp'),mfgBy:get('mfgBy'),newDescription:get('newDescription'),image:get('image'),finish:get('finish')};rec.finish=normalizeFinishText(rec.finish)||inferFinish(rec);return rec}).filter(r=>r.name);
  }

  // PROFILE ONLY: colour/body + diffuser variation is read exclusively
  // from the "New Description" column. Lighting categories do not use this.
  const profileVariationMeta={
    'White':{code:'WH',cls:'pv-white'},
    'Grey & White Diffuser':{code:'GW',cls:'pv-grey-white'},
    'Champagne & White Diffuser':{code:'CW',cls:'pv-champagne-white'},
    'Black & White Diffuser':{code:'BW',cls:'pv-black-white'},
    'Iron Grey & White Diffuser':{code:'IGW',cls:'pv-iron-white'},
    'White & White Diffuser':{code:'WW',cls:'pv-white-white'},
    'Black & Black Diffuser':{code:'BB',cls:'pv-black-black'},
    'White & Black Diffuser':{code:'WB',cls:'pv-white-black'},
    'White & Transparent Diffuser':{code:'WT',cls:'pv-white-transparent'},
    'Black & Transparent Diffuser':{code:'BT',cls:'pv-black-transparent'},
    'Black':{code:'BK',cls:'pv-black'}
  };
  function profileVariationFromDescription(value){
    let s=String(value||'')
      .replace(/<br\s*\/?>/gi,' ')
      .replace(/\r?\n/g,' ')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase()
      .replace(/transparant/g,'transparent')
      .replace(/transperant/g,'transparent');
    const tests=[
      ['Iron Grey & White Diffuser','iron grey & white diffuser'],
      ['Champagne & White Diffuser','champagne & white diffuser'],
      ['Grey & White Diffuser','grey & white diffuser'],
      ['Black & White Diffuser','black & white diffuser'],
      ['White & White Diffuser','white & white diffuser'],
      ['Black & Black Diffuser','black & black diffuser'],
      ['White & Black Diffuser','white & black diffuser'],
      ['White & Transparent Diffuser','white & transparent diffuser'],
      ['Black & Transparent Diffuser','black & transparent diffuser']
    ];
    for(const [label,phrase] of tests)if(s.includes(phrase))return label;
    if(/\bwhite\b/.test(s))return 'White';
    if(/\bblack\b/.test(s))return 'Black';
    return '';
  }
  function profileVariationCode(v){return (profileVariationMeta[v]||{}).code||v||'—'}
  function profileVariationSwatch(v){
    const meta=profileVariationMeta[v]||{cls:'pv-standard'};
    return `<span class="profile-variation-dot ${meta.cls}" aria-hidden="true"></span>`;
  }
  function preferredProfileVariant(rows,variation=''){
    if(variation){
      const hit=rows.find(r=>profileVariationFromDescription(r.newDescription)===variation&&r.image);
      if(hit)return hit;
    }
    const white=rows.find(r=>profileVariationFromDescription(r.newDescription)==='White'&&r.image);
    return white||rows.find(r=>r.image)||rows[0]||null;
  }


  // =========================================================
  // PROFILE PAGE ONLY
  // Every displayed image is bound to one exact CSV row:
  // Stock Code + New Description + colour variation + Image.
  // Other lighting categories do not use these helpers.
  // =========================================================
  function profileDescriptionHead(value){
    const parts=String(value||'')
      .replace(/<br\s*\/?>/gi,'\n')
      .split(/\r?\n/)
      .map(s=>s.trim())
      .filter(Boolean);
    return parts[0]||'';
  }
  function profileFamilyName(row){
    const head=profileDescriptionHead(row.newDescription);
    const s=cleanKey(head);

    if(s.startsWith('under cabinet')) return 'Under Cabinet';
    if(s.startsWith('cove profile flexible')) return 'Cove Flexible';
    if(s.startsWith('cove profile')) return 'Cove';
    if(s.startsWith('wide recessed')) return 'Wide Recessed';
    if(s.startsWith('slim recessed')) return 'Slim Recessed';
    if(s.startsWith('slim trimless')) return 'Slim Trimless';
    if(s.startsWith('thin recessed')) return 'Thin Recessed';
    if(s.startsWith('thin surface')) return 'Thin Surface';
    if(s.startsWith('wide surface')) return 'Wide Surface';
    if(s.startsWith('ceiling recessed')||s.startsWith('ceiling trimless')) return 'Ceiling';
    if(s.startsWith('curtain grazer')) return 'Grazer';
    if(s.startsWith('wall mounted')) return 'Wall Mounted UP/DOWN Profile';
    if(s.startsWith('wall grazer')) return 'Wall Grazer Profile';
    if(s.startsWith('lumen fly')) return 'Lumen';
    if(s.startsWith('bendable curve')) return 'Bendable';
    if(s.startsWith('thin trimless')||s.startsWith('wide trimless')||s.startsWith('deep trimless')) return 'Trimless';
    if(s.startsWith('deep surface')) return 'Surface';
    if(s.startsWith('deep recessed')) return 'Recessed';
    if(/^suspended\b/.test(s)) return 'Suspended';
    if(s.startsWith('water proof')) return 'Water Proof Profile';
    if(s.startsWith('surface indirect')) return 'Wall Mounted Profile';

    return String(row.name||head||'Profile').trim();
  }
  function profileFamilyKey(row){return cleanKey(profileFamilyName(row))}
  function groupProfileProducts(rows){
    const map=new Map();
    for(const r of rows){
      const k=profileFamilyKey(r);
      if(!map.has(k))map.set(k,{name:profileFamilyName(r),profileKey:k,variants:[]});
      map.get(k).variants.push(r);
    }
    return [...map.values()];
  }
  function profileRowKey(row){
    return `${String(row.stockCode||'').trim()}::${String(row.newDescription||'').trim()}`;
  }
  function profileOptionLabel(row){
    const variation=profileVariationFromDescription(row.newDescription);
    return profileVariationCode(variation);
  }
  function profileImageMarkup(row,width=520,extra=''){
    if(!row||!row.image)return `<span class="profile-image-unavailable">Image unavailable</span>`;
    const fast=optimizeImageUrl(row.image,width);
    const original=sourceImageUrl(row.image);
    return `<img src="${escapeHtml(fast)}" data-profile-fallback="${escapeHtml(original)}" ${extra} onerror="window.__keusProfileImageFallback&&window.__keusProfileImageFallback(this)" alt="">`;
  }
  window.__keusProfileImageFallback=function(img){
    const fallback=img.dataset.profileFallback||'';
    if(fallback && img.src!==fallback && img.dataset.profileFallbackUsed!=='1'){
      img.dataset.profileFallbackUsed='1';
      img.src=fallback;
      return;
    }
    img.style.display='none';
    const parent=img.parentElement;
    if(parent&&!parent.querySelector('.profile-image-unavailable')){
      const span=document.createElement('span');
      span.className='profile-image-unavailable';
      span.textContent='Image unavailable';
      parent.appendChild(span);
    }
  };
  function bindProfileCardSwipe(card,rows,onSelect){
    const imageArea=card.querySelector('.card-image');
    if(!imageArea||rows.length<2)return;
    let sx=0,sy=0;
    imageArea.addEventListener('touchstart',e=>{
      const t=e.touches&&e.touches[0];
      if(!t)return;
      sx=t.clientX;sy=t.clientY;
    },{passive:true});
    imageArea.addEventListener('touchend',e=>{
      if(!window.matchMedia('(max-width:780px)').matches)return;
      const t=e.changedTouches&&e.changedTouches[0];
      if(!t)return;
      const dx=t.clientX-sx,dy=t.clientY-sy;
      if(Math.abs(dx)<34||Math.abs(dx)<=Math.abs(dy))return;
      const active=card.querySelector('[data-profile-row].active');
      let idx=active?Number(active.dataset.profileIndex||0):0;
      idx=dx<0?(idx+1)%rows.length:(idx-1+rows.length)%rows.length;
      onSelect(idx);
    },{passive:true});
  }

  function groupProducts(rows){const map=new Map();for(const r of rows){const k=cleanKey(r.name);if(!map.has(k))map.set(k,{name:r.name,variants:[]});map.get(k).variants.push(r)}return[...map.values()]}
  function finishSort(a,b){const ia=finishOrder.indexOf(a),ib=finishOrder.indexOf(b);if(ia>=0||ib>=0)return(ia<0?999:ia)-(ib<0?999:ib);return naturalSort(a,b)}
  function summarize(values,joiner=' / '){const vals=unique(values);if(!vals.length)return'—';if(vals.length<=3)return vals.join(joiner);return vals.slice(0,2).join(joiner)+` +${vals.length-2}`}
  function summarizeAll(values,joiner=' / '){const vals=unique(values).sort(numericSort);return vals.length?vals.join(joiner):'—'}
  function summarizeCCT(values){const vals=unique(values);if(!vals.length)return'—';const parsed=vals.map(v=>({v,n:parseInt(String(v).replace(/[^0-9]/g,''),10)}));if(parsed.every(x=>Number.isFinite(x.n))){const nums=[...new Set(parsed.map(x=>x.n))].sort((a,b)=>a-b);if(nums.length===1)return`${nums[0]}K`;return`${nums[0]}–${nums[nums.length-1]}K`}return summarize(vals)}
  function searchMatches(r,q){if(!q)return true;const hay=[r.name,r.itemNo,r.vf,r.imax,r.cct,r.cri,r.cutout,r.beam,r.wattage,r.batchCode,r.stockCode,r.bisNo,r.bisSpec,r.mrp,r.mfgBy,r.newDescription,r.finish,r.image].join(' ').toLowerCase();return hay.includes(q)}
  function rowMatches(r,ignore=''){if(!searchMatches(r,state.q))return false;if(ignore!=='finish'&&state.finish&&r.finish!==state.finish)return false;for(const f of filterFields){if(f===ignore)continue;if(state[f]&&r[f]!==state[f])return false}return true}

  function optionSortFor(field,vals){return vals.sort(['cct','wattage','beam','cri','imax','mrp'].includes(field)?numericSort:naturalSort)}


  function initKeusFilterSelects(){
    document.querySelectorAll('select.field').forEach(select=>{
      if(select.id==='nameFilter'||select.closest('.keus-filter-select'))return;

      const wrap=document.createElement('div');
      wrap.className='keus-filter-select';
      if(select.classList.contains('watt-main'))wrap.classList.add('watt-main');
      wrap.dataset.nativeId=select.id;

      select.parentNode.insertBefore(wrap,select);
      wrap.appendChild(select);
      select.classList.add('keus-filter-native');

      const trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='keus-filter-trigger';
      trigger.setAttribute('aria-haspopup','listbox');
      trigger.setAttribute('aria-expanded','false');
      trigger.innerHTML='<span class="keus-filter-trigger-text"></span><span class="keus-filter-chevron" aria-hidden="true"></span>';

      const menu=document.createElement('div');
      menu.className='keus-filter-menu';
      menu.setAttribute('role','listbox');
      menu.hidden=true;

      wrap.appendChild(trigger);
      wrap.appendChild(menu);

      trigger.addEventListener('click',e=>{
        e.stopPropagation();
        const shouldOpen=menu.hidden;
        closeAllKeusFilterMenus();
        closeKeusProductMenu();
        if(shouldOpen)openKeusFilterMenu(wrap);
      });
    });
    syncKeusFilterMenus();
  }

  function syncKeusFilterMenu(wrap){
    const select=wrap.querySelector('select');
    const label=wrap.querySelector('.keus-filter-trigger-text');
    const menu=wrap.querySelector('.keus-filter-menu');
    if(!select||!label||!menu)return;

    const options=[...select.options];
    const selected=select.value||'';
    const selectedOption=options.find(o=>o.value===selected)||options[0];
    label.textContent=selectedOption?selectedOption.textContent:'';

    menu.innerHTML=options.map(opt=>{
      const value=opt.value||'';
      const active=value===selected;
      return `<button class="keus-filter-option ${active?'active':''}" type="button" role="option" aria-selected="${active}" data-filter-value="${escapeHtml(value)}"><span>${escapeHtml(opt.textContent)}</span><i aria-hidden="true"></i></button>`;
    }).join('');

    menu.querySelectorAll('[data-filter-value]').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      select.value=btn.dataset.filterValue;
      closeAllKeusFilterMenus();
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }

  function syncKeusFilterMenus(){
    document.querySelectorAll('.keus-filter-select').forEach(syncKeusFilterMenu);
  }

  function openKeusFilterMenu(wrap){
    const menu=wrap.querySelector('.keus-filter-menu');
    const trigger=wrap.querySelector('.keus-filter-trigger');
    if(!menu||!trigger)return;
    menu.hidden=false;
    wrap.classList.add('open');
    trigger.setAttribute('aria-expanded','true');
    const active=menu.querySelector('.keus-filter-option.active');
    if(active)setTimeout(()=>active.scrollIntoView({block:'nearest'}),0);
  }

  function closeKeusFilterMenu(wrap){
    const menu=wrap.querySelector('.keus-filter-menu');
    const trigger=wrap.querySelector('.keus-filter-trigger');
    if(!menu||!trigger)return;
    menu.hidden=true;
    wrap.classList.remove('open');
    trigger.setAttribute('aria-expanded','false');
  }

  function closeAllKeusFilterMenus(){
    document.querySelectorAll('.keus-filter-select').forEach(closeKeusFilterMenu);
  }

  function syncKeusProductMenu(){
    const menu=$('keusProductMenu'),trigger=$('keusProductTrigger'),label=$('keusProductTriggerText');
    if(!menu||!trigger||!label)return;
    const options=[...els.nameFilter.options];
    const selected=els.nameFilter.value||'';
    label.textContent=selected||'All products';
    menu.innerHTML=options.map(opt=>{
      const value=opt.value||'';
      const active=value===selected;
      return `<button class="keus-product-option ${active?'active':''}" type="button" role="option" aria-selected="${active}" data-product-value="${escapeHtml(value)}"><span>${escapeHtml(opt.textContent)}</span><i aria-hidden="true"></i></button>`;
    }).join('');
    menu.querySelectorAll('[data-product-value]').forEach(btn=>btn.addEventListener('click',()=>{
      els.nameFilter.value=btn.dataset.productValue;
      state.name=els.nameFilter.value;
      currentPage=0;
      closeKeusProductMenu();
      updateAll();
    }));
  }
  function openKeusProductMenu(){
    const wrap=$('keusProductSelect'),menu=$('keusProductMenu'),trigger=$('keusProductTrigger');
    if(!wrap||!menu||!trigger)return;
    menu.hidden=false;wrap.classList.add('open');trigger.setAttribute('aria-expanded','true');
    const active=menu.querySelector('.keus-product-option.active');
    if(active)setTimeout(()=>active.scrollIntoView({block:'nearest'}),0);
  }
  function closeKeusProductMenu(){
    const wrap=$('keusProductSelect'),menu=$('keusProductMenu'),trigger=$('keusProductTrigger');
    if(!wrap||!menu||!trigger)return;
    menu.hidden=true;wrap.classList.remove('open');trigger.setAttribute('aria-expanded','false');
  }

  function categoryStatusHtml(key){
    const cfg=CATEGORIES[key];
    const data=globalCatalogueCache[key];
    const recs=data?data.records:records;
    const gps=data?data.groups:groups;
    const finishes=unique(recs.map(r=>r.finish));
    const unknown=finishes.filter(f=>!finishOrder.includes(f));
    return `<strong>${escapeHtml(cfg.label)}</strong> · ${gps.length} products · ${recs.length} variants · ${finishes.length} finishes${unknown.length?` · ${unknown.length} custom finish${unknown.length===1?'':'es'}`:''}`;
  }

  async function getCatalogueForSearch(key){
    if(globalCatalogueCache[key])return globalCatalogueCache[key];
    const cfg=CATEGORIES[key];
    const res=await fetch(encodeURI(cfg.file),{cache:'no-store'});
    if(!res.ok)throw new Error(`${cfg.file}: ${res.status} ${res.statusText}`);
    const text=await res.text();
    const recs=normalizeRows(parseCSV(text));
    const gps=key==='profiles'?groupProfileProducts(recs):groupProducts(recs);
    const data={records:recs,groups:gps};
    globalCatalogueCache[key]=data;
    return data;
  }

  function ensureAllCataloguesForSearch(){
    if(globalCataloguePromise)return globalCataloguePromise;
    globalCataloguePromise=Promise.all(
      Object.keys(CATEGORIES).map(async key=>{
        const data=await getCatalogueForSearch(key);
        return {key,...data};
      })
    ).catch(err=>{
      globalCataloguePromise=null;
      throw err;
    });
    return globalCataloguePromise;
  }

  function globalResultDetailUrl(result){
    const row=result.row;
    const params=new URLSearchParams();
    params.set('category',result.category);

    if(result.category==='profiles'){
      const product=profileFamilyName(row);
      params.set('product',product);
      params.set('profileKey',profileFamilyKey(row));
      if(row.stockCode)params.set('stockCode',row.stockCode);
      if(row.newDescription)params.set('description',row.newDescription);
    }else{
      params.set('product',row.name);
      if(row.finish)params.set('finish',row.finish);
    }
    return `light-details.html?${params.toString()}`;
  }

  function buildGlobalSearchResults(q,datasets){
    const results=[];
    const seen=new Set();

    for(const data of datasets){
      for(const row of data.records){
        if(!searchMatches(row,q))continue;

        // Search results are image-level, not just product-level.
        // This allows different colour/product images to appear independently,
        // while duplicate technical rows using the same image are suppressed.
        const imageKey=String(row.image||'').trim();
        const key=[
          data.key,
          cleanKey(row.name),
          cleanKey(row.finish),
          imageKey||cleanKey(row.stockCode)||String(row._row)
        ].join('::');

        if(seen.has(key))continue;
        seen.add(key);
        results.push({category:data.key,row});
      }
    }
    return results;
  }

  function renderGlobalSearchResults(q){
    els.grid.innerHTML='';
    const total=globalSearchResults.length;
    const categoryCounts={};
    globalSearchResults.forEach(r=>categoryCounts[r.category]=(categoryCounts[r.category]||0)+1);

    const categoriesFound=Object.keys(categoryCounts).length;
    els.categoryTitle.textContent='Search Results';

    const summary=Object.keys(CATEGORIES)
      .filter(k=>categoryCounts[k])
      .map(k=>`${CATEGORIES[k].label} ${categoryCounts[k]}`)
      .join(' · ');

    els.catalogueCount.textContent=total
      ? `${total} image${total===1?'':'s'} · ${categoriesFound} categor${categoriesFound===1?'y':'ies'}`
      : '0 results';

    els.status.innerHTML=total
      ? `<strong>All catalogue search</strong> · “${escapeHtml(q)}” · ${escapeHtml(summary)}`
      : `<strong>All catalogue search</strong> · No result for “${escapeHtml(q)}”`;

    if(!total){
      els.grid.innerHTML=`<div class="empty global-search-empty">
        <h3>No matching products</h3>
        <p>Search checks all four catalogue sections, including product name, stock code, description, finish and image filename.</p>
      </div>`;
      els.pagination.hidden=true;
      return;
    }

    const pageSize=getPageSize();
    const pages=Math.ceil(total/pageSize);
    currentPage=Math.min(currentPage,pages-1);
    const start=currentPage*pageSize;

    globalSearchResults.slice(start,start+pageSize).forEach(result=>{
      const row=result.row;
      const cfg=CATEGORIES[result.category];
      const card=document.createElement('article');
      card.className='card global-result-card';

      const image=row.image;
      const isProfile=result.category==='profiles';
      const title=isProfile?profileFamilyName(row):row.name;
      const variation=isProfile?profileVariationFromDescription(row.newDescription):row.finish;
      const code=isProfile?profileVariationCode(variation):variation;
      const rate=!isProfile&&row.mrp?`MRP ${row.mrp}`:'';
      const kicker=row.itemNo||row.stockCode||'';
      const secondaryLabel=isProfile?'Colour':'Finish';
      const secondaryValue=code||variation||'—';

      card.innerHTML=`
        <div class="global-category-badge">${escapeHtml(cfg.label)}</div>
        <div class="global-match-badge">Match</div>
        <button class="card-open" type="button">
          <div class="card-image">
            ${image?`<img src="${escapeHtml(optimizeImageUrl(image,420))}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" fetchpriority="low">`:'<span style="font-size:11px;color:#aaa">No image</span>'}
          </div>
          <div class="card-body">
            ${kicker?`<div class="card-kicker">${escapeHtml(kicker)}</div>`:''}
            <h3 class="card-title">${escapeHtml(title)}</h3>
            ${rate?`<div class="card-price">${escapeHtml(rate)}</div>`:''}
            <div class="global-result-meta">
              <div>
                <span class="global-meta-label">${escapeHtml(secondaryLabel)}</span>
                <span class="global-meta-value">${escapeHtml(secondaryValue)}</span>
              </div>
              <div>
                <span class="global-meta-label">Stock Code</span>
                <span class="global-meta-value">${escapeHtml(row.stockCode||'—')}</span>
              </div>
            </div>
          </div>
        </button>`;

      card.querySelector('.card-open').addEventListener('click',()=>{
        window.location.href=globalResultDetailUrl(result);
      });

      els.grid.appendChild(card);
    });

    els.pagination.hidden=pages<=1;
    els.pageInfo.textContent=`Page ${currentPage+1} / ${pages}`;
    els.prevBtn.disabled=currentPage===0;
    els.nextBtn.disabled=currentPage>=pages-1;
  }

  async function runGlobalSearch(q){
    const query=String(q||'').trim().toLowerCase();
    const token=++globalSearchToken;

    if(!query){
      document.body.classList.remove('global-search-mode');
      document.body.classList.toggle('profiles-mode',activeCategory==='profiles');
      els.categoryTitle.textContent=CATEGORIES[activeCategory].label;
      els.status.innerHTML=categoryStatusHtml(activeCategory);
      globalSearchResults=[];
      currentPage=0;
      updateAll();
      return;
    }

    document.body.classList.add('global-search-mode');
    document.body.classList.remove('profiles-mode');
    els.categoryTitle.textContent='Search Results';
    els.status.innerHTML=`Searching <strong>all catalogue sections</strong> for “${escapeHtml(query)}”…`;
    els.catalogueCount.textContent='Searching…';
    els.grid.innerHTML=`<div class="empty global-search-empty"><p>Searching Downlights, Tracklights, Profiles and Outdoor Lights…</p></div>`;
    els.pagination.hidden=true;

    try{
      const datasets=await ensureAllCataloguesForSearch();
      if(token!==globalSearchToken)return;
      globalSearchResults=buildGlobalSearchResults(query,datasets);
      currentPage=0;
      renderGlobalSearchResults(query);
    }catch(err){
      console.error(err);
      if(token!==globalSearchToken)return;
      els.status.innerHTML=`<strong>Global search could not load all catalogue files.</strong>`;
      els.grid.innerHTML=`<div class="empty global-search-empty"><p>${escapeHtml(err.message||String(err))}</p></div>`;
      els.pagination.hidden=true;
    }
  }

  function refreshSelectOptions(){
    for(const field of filterFields){const select=filterEls[field];if(!select)continue;const current=state[field];const optionSource=field==='beam'?records:records.filter(r=>rowMatches(r,field));const vals=optionSortFor(field,unique(optionSource.map(r=>r[field])));select.innerHTML=`<option value="">${escapeHtml(optionLabels[field])}</option>`+vals.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');if(current&&vals.includes(current))select.value=current;else if(current){state[field]='';select.value=''}}
    syncKeusProductMenu();
    syncKeusFilterMenus();
  }
  function refreshFinishChips(){
    if(activeCategory==='profiles'){
      state.finish='';
      els.finishChips.innerHTML='';
      return;
    }
    const selected=selectedProductGroup();const source=selected?rowsForSelectedProductAllFinishes(selected):records.filter(r=>rowMatches(r,'finish'));const available=unique(source.map(r=>r.finish)).sort(finishSort);if(state.finish&&!available.includes(state.finish))state.finish='';
    els.finishChips.innerHTML=`<button class="finish-chip ${state.finish?'':'active'}" type="button" data-finish="">${swatchHtml('',true)}<span>All</span></button>`+available.map(f=>`<button class="finish-chip ${state.finish===f?'active':''}" type="button" data-finish="${escapeHtml(f)}">${swatchHtml(f)}<span>${escapeHtml(f)}</span></button>`).join('');
    els.finishChips.querySelectorAll('[data-finish]').forEach(btn=>btn.addEventListener('click',()=>{state.finish=btn.dataset.finish||'';cardFinishSelections.clear();currentPage=0;updateAll()}));
  }
  function refreshActiveFilters(){
    const pills=[];if(state.q)pills.push(`<button class="filter-pill" type="button" data-clear="q"><b>Search:</b> ${escapeHtml(state.q)} <span>×</span></button>`);for(const f of [...filterFields,'finish'])if(state[f])pills.push(`<button class="filter-pill" type="button" data-clear="${f}"><b>${escapeHtml(filterLabels[f])}:</b> ${escapeHtml(state[f])} <span>×</span></button>`);els.activeFilters.innerHTML=pills.join('');els.activeFilters.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',()=>{const f=b.dataset.clear;state[f]='';if(f==='q')els.searchBox.value='';else if(filterEls[f])filterEls[f].value='';currentPage=0;updateAll()}));
  }
  function computeViewGroups(){viewGroups=groups.map(g=>{const matched=g.variants.filter(r=>rowMatches(r));return{...g,matchedVariants:matched}}).filter(g=>g.matchedVariants.length)}
  function updateAll(){refreshSelectOptions();refreshFinishChips();computeViewGroups();refreshActiveFilters();renderCatalogue()}

  function representativeVariant(group,rowsOverride=null,finishOverride=''){const rows=rowsOverride&&rowsOverride.length?rowsOverride:(group.matchedVariants.length?group.matchedVariants:group.variants);const requested=finishOverride||state.finish;if(requested){const hit=rows.find(r=>r.finish===requested&&r.image);if(hit)return hit}const white=rows.find(r=>r.finish==='White'&&r.image);return white||rows.find(r=>r.image)||rows[0]||null}
  function selectedProductGroup(){if(!state.name)return null;return groups.find(g=>g.name===state.name)||null}
  function rowsForSelectedProductAllFinishes(group){if(!group)return[];return group.variants.filter(r=>{if(!searchMatches(r,state.q))return false;for(const f of filterFields){if(f==='name'||f==='finish')continue;if(state[f]&&r[f]!==state[f])return false}return true})}
  function detailUrl(group,preferredFinish=''){
    const params=new URLSearchParams();
    params.set('category',activeCategory);
    params.set('product',group.name);
    if(preferredFinish)params.set('finish',preferredFinish);
    return `light-details.html?${params.toString()}`;
  }
  function goToDetail(group,preferredFinish=''){
    window.location.href=detailUrl(group,preferredFinish);
  }
  function cardFinishKey(group){
    return `${activeCategory}::${cleanKey(group.name)}`;
  }
  function changeOnlyThisCardFinish(card,group,finish){
    const key=cardFinishKey(group);
    cardFinishSelections.set(key,finish);
    const visual=representativeVariant(group,group.variants,finish);
    const img=card.querySelector('.card-image img');
    if(img&&visual&&visual.image){
      img.src=optimizeImageUrl(visual.image,420);
      img.alt=`${group.name} · ${finish}`;
    }
    const rate=card.querySelector('[data-card-rate]');
    if(rate) rate.textContent=visual&&visual.mrp?`MRP ${visual.mrp}`:'Price on request';

    let activeDot=null;
    card.querySelectorAll('[data-card-finish]').forEach(btn=>{
      const active=btn.dataset.cardFinish===finish;
      btn.classList.toggle('active',active);
      if(active) activeDot=btn;
    });

    // All finish dots stay visible on mobile; active state is enough.
  }



  function preloadCardFinish(group,finish){
    return new Promise(resolve=>{
      const visual=representativeVariant(group,group.variants,finish);
      if(!visual||!visual.image){resolve('');return}
      const src=optimizeImageUrl(visual.image,420);
      const pre=new Image();
      pre.decoding='async';
      pre.onload=()=>resolve(src);
      pre.onerror=()=>resolve(src);
      pre.src=src;
      if(pre.complete)resolve(src);
    });
  }

  function preloadAdjacentCardFinishes(group,finishes,currentFinish){
    if(!finishes||finishes.length<2)return;
    let idx=finishes.indexOf(currentFinish);
    if(idx<0)idx=0;
    [
      finishes[(idx+1)%finishes.length],
      finishes[(idx-1+finishes.length)%finishes.length]
    ].forEach(f=>{
      const visual=representativeVariant(group,group.variants,f);
      if(visual&&visual.image){
        const pre=new Image();
        pre.decoding='async';
        pre.src=optimizeImageUrl(visual.image,420);
      }
    });
  }

  async function smoothChangeCardFinish(card,group,finishes,nextFinish,direction=0){
    if(!nextFinish||card.dataset.finishAnimating==='1')return;

    const current=cardFinishSelections.get(cardFinishKey(group))||state.finish||finishes[0]||'';
    if(current===nextFinish){
      changeOnlyThisCardFinish(card,group,nextFinish);
      return;
    }

    const img=card.querySelector('.card-image img');
    if(!img||typeof img.animate!=='function'){
      changeOnlyThisCardFinish(card,group,nextFinish);
      preloadAdjacentCardFinishes(group,finishes,nextFinish);
      return;
    }

    card.dataset.finishAnimating='1';

    // Preload the next finish first to avoid a white flash.
    await preloadCardFinish(group,nextFinish);

    const mobile=window.matchMedia('(max-width:780px)').matches;
    const fadeOut=mobile?90:75;
    const fadeIn=mobile?125:95;
    const lowOpacity=mobile?.18:.28;

    try{
      const exit=img.animate(
        [
          {opacity:1},
          {opacity:lowOpacity}
        ],
        {duration:fadeOut,easing:'ease-out',fill:'forwards'}
      );
      await exit.finished.catch(()=>{});

      // Image, MRP and selected finish dot update together.
      changeOnlyThisCardFinish(card,group,nextFinish);

      const currentImg=card.querySelector('.card-image img');
      if(currentImg){
        currentImg.style.opacity=String(lowOpacity);

        const enter=currentImg.animate(
          [
            {opacity:lowOpacity},
            {opacity:1}
          ],
          {duration:fadeIn,easing:'ease-out',fill:'forwards'}
        );
        await enter.finished.catch(()=>{});
        currentImg.style.opacity='';
      }
    }finally{
      card.dataset.finishAnimating='0';
      preloadAdjacentCardFinishes(group,finishes,nextFinish);
    }
  }

  function changeCardFinishByStep(card,group,finishes,step){
    if(!finishes||finishes.length<2)return;
    const current=cardFinishSelections.get(cardFinishKey(group))||state.finish||finishes[0];
    let idx=finishes.indexOf(current);
    if(idx<0)idx=0;
    idx=(idx+step+finishes.length)%finishes.length;
    smoothChangeCardFinish(card,group,finishes,finishes[idx],step>0?1:-1);
  }

  function bindDesktopFinishControls(card,group,finishes){
    if(!finishes||finishes.length<2)return;
    const imageArea=card.querySelector('.card-image');
    const prev=card.querySelector('[data-finish-prev]');
    const next=card.querySelector('[data-finish-next]');

    if(prev)prev.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      changeCardFinishByStep(card,group,finishes,-1);
    });
    if(next)next.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      changeCardFinishByStep(card,group,finishes,1);
    });

    if(!imageArea)return;

    // Horizontal trackpad gesture on desktop.
    let lastWheel=0;
    imageArea.addEventListener('wheel',e=>{
      if(!window.matchMedia('(min-width:781px)').matches)return;
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)||Math.abs(e.deltaX)<12)return;
      const now=Date.now();
      if(now-lastWheel<220)return;
      lastWheel=now;
      e.preventDefault();
      changeCardFinishByStep(card,group,finishes,e.deltaX>0?1:-1);
    },{passive:false});

    // Mouse / pen drag left-right on the image.
    let down=false,startX=0,startY=0,pointerId=null;
    imageArea.addEventListener('pointerdown',e=>{
      if(!window.matchMedia('(min-width:781px)').matches)return;
      if(e.pointerType==='touch')return;
      down=true;
      startX=e.clientX;
      startY=e.clientY;
      pointerId=e.pointerId;
      imageArea.classList.add('is-dragging');
      try{imageArea.setPointerCapture(pointerId)}catch(_){}
    });

    imageArea.addEventListener('pointerup',e=>{
      if(!down)return;
      down=false;
      imageArea.classList.remove('is-dragging');
      const dx=e.clientX-startX;
      const dy=e.clientY-startY;
      if(Math.abs(dx)>=42&&Math.abs(dx)>Math.abs(dy)){
        card.dataset.suppressOpen='1';
        changeCardFinishByStep(card,group,finishes,dx<0?1:-1);
        setTimeout(()=>{if(card.dataset.suppressOpen==='1')card.dataset.suppressOpen='0'},350);
      }
      try{imageArea.releasePointerCapture(pointerId)}catch(_){}
    });

    imageArea.addEventListener('pointercancel',()=>{
      down=false;
      imageArea.classList.remove('is-dragging');
    });
  }

  function bindMobileFinishSwipe(card,group,finishes){
    const imageArea=card.querySelector('.card-image');
    if(!imageArea || !finishes || finishes.length<2) return;

    let startX=0,startY=0;
    imageArea.addEventListener('touchstart',e=>{
      const t=e.touches&&e.touches[0];
      if(!t) return;
      startX=t.clientX;
      startY=t.clientY;
    },{passive:true});

    imageArea.addEventListener('touchend',e=>{
      if(!window.matchMedia('(max-width:780px)').matches) return;
      const t=e.changedTouches&&e.changedTouches[0];
      if(!t) return;

      const dx=t.clientX-startX;
      const dy=t.clientY-startY;
      if(Math.abs(dx)<34 || Math.abs(dx)<=Math.abs(dy)) return;

      const current=cardFinishSelections.get(cardFinishKey(group))||state.finish||finishes[0];
      let idx=finishes.indexOf(current);
      if(idx<0) idx=0;
      idx = dx<0 ? (idx+1)%finishes.length : (idx-1+finishes.length)%finishes.length;
      smoothChangeCardFinish(card,group,finishes,finishes[idx],dx<0?1:-1);
    },{passive:true});

    const initialFinish=cardFinishSelections.get(cardFinishKey(group))||state.finish||finishes[0];
    preloadAdjacentCardFinishes(group,finishes,initialFinish);
  }
  function renderProfileCatalogue(){
    const total=viewGroups.length;
    const totalMatched=viewGroups.reduce((n,g)=>n+g.matchedVariants.length,0);
    els.catalogueCount.textContent=`${total} profile${total===1?'':'s'} · ${totalMatched} stock-code variant${totalMatched===1?'':'s'}`;
    els.grid.innerHTML='';

    if(!records.length){
      els.grid.innerHTML=`<div class="empty"><h3>Profile catalogue unavailable</h3><p>The Profiles CSV needs Name, Stock Code, Cutout, New Description and Image.</p></div>`;
      els.pagination.hidden=true;
      return;
    }
    if(!total){
      els.grid.innerHTML=`<div class="empty"><h3>No matching profiles</h3><p>Remove one or more filters to widen the result.</p><button class="btn" id="emptyReset" type="button">Reset All Filters</button></div>`;
      els.pagination.hidden=true;
      $('emptyReset').addEventListener('click',resetAll);
      return;
    }

    const pages=Math.ceil(total/getPageSize());
    currentPage=Math.min(currentPage,pages-1);
    const pageStart=currentPage*getPageSize();

    viewGroups.slice(pageStart,pageStart+getPageSize()).forEach(g=>{
      const rows=g.matchedVariants.length?g.matchedVariants:g.variants;
      const card=document.createElement('article');
      card.className='card profile-card exact-profile-card';

      let selectedIndex=0;
      const stored=profileVariationSelections.get(`profile-row::${g.profileKey||cleanKey(g.name)}`);
      if(stored){
        const found=rows.findIndex(r=>profileRowKey(r)===stored);
        if(found>=0)selectedIndex=found;
      }

      const preloadProfileRow=(row)=>{
        return new Promise(resolve=>{
          if(!row||!row.image){resolve();return}
          const pre=new Image();
          pre.decoding='async';
          pre.onload=resolve;
          pre.onerror=resolve;
          pre.src=optimizeImageUrl(row.image,420);
          if(pre.complete)resolve();
        });
      };

      const preloadAdjacentProfileRows=(idx)=>{
        if(rows.length<2)return;
        const next=rows[(idx+1)%rows.length];
        const prev=rows[(idx-1+rows.length)%rows.length];
        [next,prev].forEach(r=>{
          if(r&&r.image){
            const pre=new Image();
            pre.decoding='async';
            pre.src=optimizeImageUrl(r.image,420);
          }
        });
      };

      const renderSelection=async(idx,useFade=true)=>{
        const nextIndex=Math.max(0,Math.min(rows.length-1,idx));
        const row=rows[nextIndex];

        const applySelection=()=>{
          selectedIndex=nextIndex;
          profileVariationSelections.set(`profile-row::${g.profileKey||cleanKey(g.name)}`,profileRowKey(row));

          const imageBox=card.querySelector('.card-image');
          if(imageBox){
            imageBox.innerHTML=profileImageMarkup(row,420,`loading="lazy" decoding="async" fetchpriority="low"`);
            const img=imageBox.querySelector('img');
            if(img)img.alt=`${g.name} · ${row.stockCode||''}`;
          }

          const stock=card.querySelector('[data-profile-stock]');
          const cutout=card.querySelector('[data-profile-cutout]');
          const desc=card.querySelector('[data-profile-description]');
          const counter=card.querySelector('[data-profile-counter]');
          if(stock)stock.textContent=row.stockCode||'—';
          if(cutout)cutout.textContent=row.cutout||'—';
          if(desc)desc.textContent=row.newDescription||'—';
          if(counter)counter.textContent=`${selectedIndex+1} / ${rows.length}`;

          card.querySelectorAll('[data-profile-row]').forEach((btn,i)=>{
            btn.classList.toggle('active',i===selectedIndex);
          });
        };

        if(!useFade||card.dataset.profileAnimating==='1'){
          if(card.dataset.profileAnimating!=='1')applySelection();
          return;
        }

        const imageBox=card.querySelector('.card-image');
        const currentImg=imageBox&&imageBox.querySelector('img');
        if(!currentImg||typeof currentImg.animate!=='function'){
          applySelection();
          preloadAdjacentProfileRows(nextIndex);
          return;
        }

        card.dataset.profileAnimating='1';
        await preloadProfileRow(row);

        const mobile=window.matchMedia('(max-width:780px)').matches;
        const fadeOut=mobile?90:75;
        const fadeIn=mobile?125:95;
        const lowOpacity=mobile?.18:.28;

        try{
          const exit=currentImg.animate(
            [{opacity:1},{opacity:lowOpacity}],
            {duration:fadeOut,easing:'ease-out',fill:'forwards'}
          );
          await exit.finished.catch(()=>{});

          applySelection();

          const incoming=card.querySelector('.card-image img');
          if(incoming&&typeof incoming.animate==='function'){
            incoming.style.opacity=String(lowOpacity);
            const enter=incoming.animate(
              [{opacity:lowOpacity},{opacity:1}],
              {duration:fadeIn,easing:'ease-out',fill:'forwards'}
            );
            await enter.finished.catch(()=>{});
            incoming.style.opacity='';
          }
        }finally{
          card.dataset.profileAnimating='0';
          preloadAdjacentProfileRows(selectedIndex);
        }
      };

      const first=rows[selectedIndex]||rows[0];

      card.innerHTML=`
        <div class="series-variant-badge">${rows.length} variant${rows.length===1?'':'s'}</div>
        <button class="card-open" type="button">
          <div class="card-image">${profileImageMarkup(first,420,`loading="lazy" decoding="async" fetchpriority="low"`)}</div>
          <div class="card-body">
            <div class="card-kicker" data-profile-stock>${escapeHtml(first&&first.stockCode||'—')}</div>
            <h3 class="card-title">${escapeHtml(g.name)}</h3>
            <div class="profile-specs">
              <div class="profile-spec"><div class="profile-spec-label">Stock Code</div><div class="profile-spec-value" data-profile-stock>${escapeHtml(first&&first.stockCode||'—')}</div></div>
              <div class="profile-spec"><div class="profile-spec-label">Cutout</div><div class="profile-spec-value" data-profile-cutout>${escapeHtml(first&&first.cutout||'—')}</div></div>
            </div>
            <div class="profile-description" data-profile-description>${escapeHtml(first&&first.newDescription||'—')}</div>
          </div>
        </button>
        <div class="card-body profile-exact-selector" style="padding-top:0">
          <div class="profile-selector-head"><span>Variants & Colours</span><span data-profile-counter>${selectedIndex+1} / ${rows.length}</span></div>
          <div class="profile-row-options">
            ${rows.map((r,i)=>{
              const variation=profileVariationFromDescription(r.newDescription);
              return `<button class="profile-row-option ${i===selectedIndex?'active':''}" type="button" data-profile-row="${escapeHtml(profileRowKey(r))}" data-profile-index="${i}" title="${escapeHtml((r.stockCode||'')+' · '+(r.newDescription||''))}">
                ${profileVariationSwatch(variation)}
                <span>${escapeHtml(profileOptionLabel(r))}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
        <div class="card-body" style="padding-top:0">
          <div class="card-foot"><span></span><button class="profile-details-btn" type="button">View Details <b>→</b></button></div>
        </div>`;

      card.querySelectorAll('[data-profile-row]').forEach((btn,i)=>btn.addEventListener('click',e=>{
        e.preventDefault();
        e.stopPropagation();
        renderSelection(i);
      }));

      const goProfileDetail=()=>{
        const row=rows[selectedIndex]||rows[0];
        const params=new URLSearchParams();
        params.set('category','profiles');
        params.set('product',g.name);
        params.set('profileKey',g.profileKey||cleanKey(g.name));
        if(row&&row.stockCode)params.set('stockCode',row.stockCode);
        if(row&&row.newDescription)params.set('description',row.newDescription);
        window.location.href=`light-details.html?${params.toString()}`;
      };

      card.querySelector('.card-open').addEventListener('click',goProfileDetail);
      card.querySelector('.profile-details-btn').addEventListener('click',goProfileDetail);
      bindProfileCardSwipe(card,rows,renderSelection);

      els.grid.appendChild(card);
      preloadAdjacentProfileRows(selectedIndex);
    });

    els.pagination.hidden=pages<=1;
    els.pageInfo.textContent=`Page ${currentPage+1} / ${pages}`;
    els.prevBtn.disabled=currentPage===0;
    els.nextBtn.disabled=currentPage>=pages-1;
  }

  function renderCatalogue(){
    els.grid.innerHTML='';
    if(activeCategory==='profiles'){
      renderProfileCatalogue();
      return;
    }

    // When one product is selected, the catalogue becomes a finish gallery.
    // This intentionally keeps every available colour/finish of that product visible.
    const productGroup=selectedProductGroup();
    if(productGroup){
      const baseRows=rowsForSelectedProductAllFinishes(productGroup);
      let finishes=unique(baseRows.map(r=>r.finish)).sort(finishSort);
      if(state.finish)finishes=finishes.filter(f=>f===state.finish);
      const cards=finishes.map(f=>{
        const rows=baseRows.filter(r=>r.finish===f);
        return {finish:f,rows,rep:representativeVariant(productGroup,rows,f)};
      }).filter(x=>x.rows.length);

      els.catalogueCount.textContent=`${productGroup.name} · ${cards.length} finish${cards.length===1?'':'es'} · ${baseRows.length} matching variant${baseRows.length===1?'':'s'}`;
      if(!records.length){els.grid.innerHTML=`<div class="empty"><h3>Catalogue data unavailable</h3><p>The page reads Name, Item No, Vf, Imax, CCT, CRI, Cutout, Beam Angle, Wattage, Batch Code, Stock Code, BIS No, BIS SEC, MRP, MFG BY and IMAGE.</p><span class="btn" style="cursor:default">CSV file not found</span></div>`;els.pagination.hidden=true;return}
      if(!cards.length){els.grid.innerHTML=`<div class="empty"><h3>No matching finishes</h3><p>${escapeHtml(productGroup.name)} has no variants matching the active technical filters.</p><button class="btn" id="emptyReset" type="button">Reset All Filters</button></div>`;els.pagination.hidden=true;$('emptyReset').addEventListener('click',resetAll);return}

      const pages=Math.ceil(cards.length/getPageSize());currentPage=Math.min(currentPage,pages-1);const pageStart=currentPage*getPageSize();
      cards.slice(pageStart,pageStart+getPageSize()).forEach(entry=>{
        const {finish,rows,rep}=entry;const img=rep&&rep.image;const card=document.createElement('article');card.className='card finish-gallery-card';
        card.innerHTML=`<button class="card-open" type="button"><div class="card-image">${img?`<img src="${escapeHtml(optimizeImageUrl(img,420))}" alt="${escapeHtml(productGroup.name)} · ${escapeHtml(finish)}" loading="lazy" decoding="async" fetchpriority="low">`:'<span style="font-size:11px;color:#aaa">No image</span>'}</div><div class="card-body"><div class="card-kicker">${escapeHtml(summarize(rows.map(v=>v.itemNo)))}</div><h3 class="card-title">${escapeHtml(productGroup.name)}</h3><div class="card-price">${rep&&rep.mrp?`MRP ${escapeHtml(rep.mrp)}`:'Price on request'}</div><div class="finish-name">${swatchHtml(finish)}<span>${escapeHtml(finish)}</span></div><div class="spec-row"><div class="mini-spec"><div class="mini-label">Wattage</div><div class="mini-value">${escapeHtml(summarize(rows.map(v=>v.wattage)))}</div></div><div class="mini-spec"><div class="mini-label">CCT</div><div class="mini-value">${escapeHtml(summarizeCCT(rows.map(v=>v.cct)))}</div></div><div class="mini-spec"><div class="mini-label">Beam</div><div class="mini-value beam-values">${escapeHtml(summarizeAll(rows.map(v=>v.beam)))}</div></div><div class="mini-spec"><div class="mini-label">CRI</div><div class="mini-value">${escapeHtml(summarize(rows.map(v=>v.cri)))}</div></div></div><div class="card-foot"><span>${rows.length} variant${rows.length===1?'':'s'}</span><span class="view-detail-cta">View Details <b>→</b></span></div></div></button>`;
        card.querySelector('.card-open').addEventListener('click',()=>goToDetail(productGroup,finish));els.grid.appendChild(card);
      });
      els.pagination.hidden=pages<=1;els.pageInfo.textContent=`Page ${currentPage+1} / ${pages}`;els.prevBtn.disabled=currentPage===0;els.nextBtn.disabled=currentPage>=pages-1;return;
    }

    const total=viewGroups.length;const totalMatched=viewGroups.reduce((n,g)=>n+g.matchedVariants.length,0);els.catalogueCount.textContent=`${total} product${total===1?'':'s'} · ${totalMatched} matching variant${totalMatched===1?'':'s'} · ${records.length} total`;
    if(!records.length){els.grid.innerHTML=`<div class="empty"><h3>Catalogue data unavailable</h3><p>The page reads Name, Item No, Vf, Imax, CCT, CRI, Cutout, Beam Angle, Wattage, Batch Code, Stock Code, BIS No, BIS SEC, MRP, MFG BY and IMAGE. Finish is resolved automatically from the stock-code suffix.</p><span class="btn" style="cursor:default">CSV file not found</span></div>`;els.pagination.hidden=true;return}
    if(!total){els.grid.innerHTML=`<div class="empty"><h3>No matching variants</h3><p>The filters work at variant level, not only product level. Remove one or more filters to widen the result.</p><button class="btn" id="emptyReset" type="button">Reset All Filters</button></div>`;els.pagination.hidden=true;$('emptyReset').addEventListener('click',resetAll);return}
    const pages=Math.ceil(total/getPageSize());currentPage=Math.min(currentPage,pages-1);const pageStart=currentPage*getPageSize();viewGroups.slice(pageStart,pageStart+getPageSize()).forEach(g=>{
      const rows=g.matchedVariants,allFinishes=unique(g.variants.map(v=>v.finish)).sort(finishSort),matchedFinishes=unique(rows.map(v=>v.finish)).sort(finishSort);const card=document.createElement('article');card.className='card';let localFinish=state.finish||cardFinishSelections.get(cardFinishKey(g))||'';const rep=representativeVariant(g,g.variants,localFinish);if(!localFinish&&rep&&rep.finish){localFinish=rep.finish;cardFinishSelections.set(cardFinishKey(g),localFinish)}const img=rep&&rep.image;
      card.innerHTML=`<div class="series-variant-badge">${g.variants.length} variant${g.variants.length===1?'':'s'}</div>${rows.length<g.variants.length?`<div class="match-tag">${rows.length} match${rows.length===1?'':'es'}</div>`:''}<button class="card-open" type="button"><div class="card-image">${img?`<img src="${escapeHtml(optimizeImageUrl(img,420))}" alt="${escapeHtml(g.name)}" loading="lazy" decoding="async" fetchpriority="low">`:'<span style="font-size:11px;color:#aaa">No image</span>'}</div><div class="card-body"><div class="card-kicker">${escapeHtml(summarize(rows.map(v=>v.itemNo)))}</div><h3 class="card-title">${escapeHtml(g.name)}</h3><div class="card-price" data-card-rate>${rep&&rep.mrp?`MRP ${escapeHtml(rep.mrp)}`:'Price on request'}</div><div class="spec-row"><div class="mini-spec"><div class="mini-label">Wattage</div><div class="mini-value">${escapeHtml(summarize(rows.map(v=>v.wattage)))}</div></div><div class="mini-spec"><div class="mini-label">CCT</div><div class="mini-value">${escapeHtml(summarizeCCT(rows.map(v=>v.cct)))}</div></div><div class="mini-spec"><div class="mini-label">Beam</div><div class="mini-value beam-values">${escapeHtml(summarizeAll(rows.map(v=>v.beam)))}</div></div><div class="mini-spec"><div class="mini-label">CRI</div><div class="mini-value">${escapeHtml(summarize(rows.map(v=>v.cri)))}</div></div></div></div></button><div class="card-body" style="padding-top:0"><div class="card-finishes"><span class="card-finish-label">Finishes</span>${allFinishes.map(f=>`<button class="card-swatch ${localFinish===f?'active':''}" type="button" data-card-finish="${escapeHtml(f)}" title="${escapeHtml(f)}">${swatchHtml(f)}</button>`).join('')}</div><div class="card-foot"><span>${rows.length}${rows.length!==g.variants.length?` / ${g.variants.length}`:''} variant${g.variants.length===1?'':'s'}</span><button class="view-detail-cta" type="button">View Details <b>→</b></button></div></div>`;
      card.querySelector('.card-open').addEventListener('click',e=>{if(card.dataset.suppressOpen==='1'){e.preventDefault();e.stopPropagation();card.dataset.suppressOpen='0';return}goToDetail(g,state.finish||cardFinishSelections.get(cardFinishKey(g))||'')});card.querySelector('.view-detail-cta').addEventListener('click',()=>goToDetail(g,state.finish||cardFinishSelections.get(cardFinishKey(g))||''));card.querySelectorAll('[data-card-finish]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const next=btn.dataset.cardFinish;const current=cardFinishSelections.get(cardFinishKey(g))||state.finish||allFinishes[0];const from=allFinishes.indexOf(current),to=allFinishes.indexOf(next);smoothChangeCardFinish(card,g,allFinishes,next,to>=from?1:-1)}));bindMobileFinishSwipe(card,g,allFinishes);bindDesktopFinishControls(card,g,allFinishes);preloadAdjacentCardFinishes(g,allFinishes,cardFinishSelections.get(cardFinishKey(g))||state.finish||allFinishes[0]);els.grid.appendChild(card)
    });
    els.pagination.hidden=pages<=1;els.pageInfo.textContent=`Page ${currentPage+1} / ${pages}`;els.prevBtn.disabled=currentPage===0;els.nextBtn.disabled=currentPage>=pages-1;
  }

  function specCell(label,value){return `<div class="spec-cell"><div class="spec-label">${escapeHtml(label)}</div><div class="spec-value">${escapeHtml(value||'—')}</div></div>`}
  function openDetail(group,preferredFinish=''){
    activeGroup=group;const rows=(state.name===group.name?rowsForSelectedProductAllFinishes(group):(group.matchedVariants.length?group.matchedVariants:group.variants));const finishes=unique(rows.map(v=>v.finish)).sort(finishSort);activeFinish=preferredFinish&&finishes.includes(preferredFinish)?preferredFinish:(state.finish&&finishes.includes(state.finish)?state.finish:(finishes.includes('White')?'White':finishes[0]||''));els.detailTitle.textContent=group.name;els.detailKicker.textContent=summarize(rows.map(v=>v.itemNo));els.detailSub.textContent=rows.length===group.variants.length?`${rows.length} technical variant${rows.length===1?'':'s'} · ${finishes.length} finish${finishes.length===1?'':'es'}`:`${rows.length} matching of ${group.variants.length} total variants · ${finishes.length} available finish${finishes.length===1?'':'es'}`;
    els.specGrid.innerHTML=[['Vf',summarize(rows.map(v=>v.vf))],['Imax',summarize(rows.map(v=>v.imax))],['Wattage',summarize(rows.map(v=>v.wattage))],['CCT',summarizeCCT(rows.map(v=>v.cct))],['CRI',summarize(rows.map(v=>v.cri))],['Beam Angle',summarizeAll(rows.map(v=>v.beam))],['Cutout',summarize(rows.map(v=>v.cutout))],['Batch Code',summarize(rows.map(v=>v.batchCode))],['Stock Codes',`${unique(rows.map(v=>v.stockCode)).length} available`],['BIS No',summarize(rows.map(v=>v.bisNo))],['BIS SEC',summarizeAll(rows.map(v=>v.bisSpec),' · ')],['MRP',summarize(rows.map(v=>v.mrp))],['MFG BY',summarize(rows.map(v=>v.mfgBy))]].map(([l,v])=>specCell(l,v)).join('');renderDetailFinishOptions(rows);renderDetailImageAndRows(rows);els.modal.classList.add('open');document.body.style.overflow='hidden'
  }
  function renderDetailFinishOptions(rows){const finishes=unique(rows.map(v=>v.finish)).sort(finishSort);els.detailFinishOptions.innerHTML=finishes.map(f=>`<button class="finish-option ${activeFinish===f?'active':''}" type="button" data-detail-finish="${escapeHtml(f)}">${swatchHtml(f)}<span>${escapeHtml(f)}</span></button>`).join('');els.detailFinishOptions.querySelectorAll('[data-detail-finish]').forEach(btn=>btn.addEventListener('click',()=>{activeFinish=btn.dataset.detailFinish;renderDetailFinishOptions(rows);renderDetailImageAndRows(rows)}))}
  function renderDetailImageAndRows(rows){
    const finishRows=activeFinish?rows.filter(r=>r.finish===activeFinish):rows;const urls=unique(finishRows.map(v=>v.image));if(!activeImage||!urls.includes(activeImage))activeImage=urls[0]||'';els.thumbs.innerHTML='';if(activeImage){els.detailImage.src=optimizeImageUrl(activeImage,1200);els.detailImage.alt=`${activeGroup.name} · ${activeFinish}`;}else{els.detailImage.removeAttribute('src');els.detailImage.alt='No product image'}
    urls.forEach(url=>{const b=document.createElement('button');b.type='button';b.className='thumb'+(url===activeImage?' active':'');b.innerHTML=`<img src="${escapeHtml(optimizeImageUrl(url,180))}" alt="${escapeHtml(activeFinish)}" loading="lazy" decoding="async">`;b.addEventListener('click',()=>{activeImage=url;renderDetailImageAndRows(rows)});els.thumbs.appendChild(b)});els.finishNote.textContent=activeFinish?`Selected finish: ${activeFinish}`:'All finishes';renderVariants(finishRows)
  }
  function renderVariants(rows){els.variantFilterNote.textContent=`${rows.length} variant${rows.length===1?'':'s'} shown${activeFinish?` · ${activeFinish}`:''}`;els.variantBody.innerHTML=rows.map(v=>`<tr><td><span class="finish-cell">${swatchHtml(v.finish)}${escapeHtml(v.finish||'—')}</span></td><td>${escapeHtml(v.cct||'—')}</td><td>${escapeHtml(v.vf||'—')}</td><td>${escapeHtml(v.imax||'—')}</td><td>${escapeHtml(v.cri||'—')}</td><td>${escapeHtml(v.cutout||'—')}</td><td>${escapeHtml(v.beam||'—')}</td><td>${escapeHtml(v.wattage||'—')}</td><td>${escapeHtml(v.batchCode||'—')}</td><td>${escapeHtml(v.itemNo||'—')}</td><td class="stock">${escapeHtml(v.stockCode||'—')}</td><td>${escapeHtml(v.bisNo||'—')}</td><td class="bis-spec-cell">${escapeHtml(v.bisSpec||'—')}</td><td class="mrp-cell">${escapeHtml(v.mrp||'—')}</td><td class="mfg-cell">${escapeHtml(v.mfgBy||'—')}</td></tr>`).join('')}
  function closeDetail(){els.modal.classList.remove('open');document.body.style.overflow='';activeGroup=null;activeFinish='';activeImage=''}

  function syncStateFromUI(){state.q=els.searchBox.value.trim().toLowerCase();for(const f of filterFields)state[f]=filterEls[f].value}
  function resetAll(){Object.keys(state).forEach(k=>state[k]='');els.searchBox.value='';for(const f of filterFields)filterEls[f].value='';currentPage=0;updateAll()}
  function loadCSVText(text,label='CSV file'){
    try{const rows=parseCSV(text);records=normalizeRows(rows);if(!records.length)throw new Error('No product rows were found in the CSV.');groups=activeCategory==='profiles'?groupProfileProducts(records):groupProducts(records);globalCatalogueCache[activeCategory]={records:[...records],groups:[...groups]};Object.keys(state).forEach(k=>state[k]='');els.searchBox.value='';for(const f of filterFields)filterEls[f].value='';currentPage=0;const finishes=unique(records.map(r=>r.finish));const unknown=finishes.filter(f=>!finishOrder.includes(f));els.status.innerHTML=`<strong>${escapeHtml(label)}</strong> · ${groups.length} products · ${records.length} variants · ${finishes.length} finishes${unknown.length?` · ${unknown.length} custom finish${unknown.length===1?'':'es'}`:''}`;updateAll()}catch(err){console.error(err);els.status.innerHTML=`<strong>Could not load CSV.</strong> ${escapeHtml(err.message||String(err))}`;records=[];groups=[];viewGroups=[];renderCatalogue()}
  }
  async function loadCategory(key){
    const cfg=CATEGORIES[key];
    if(!cfg)return;
    ++globalSearchToken;
    clearTimeout(globalSearchTimer);
    document.body.classList.remove('global-search-mode');
    globalSearchResults=[];
    activeCategory=key;
    document.body.classList.toggle('profiles-mode',key==='profiles');
    cardFinishSelections.clear();
    els.categoryTitle.textContent=cfg.label;
    els.categoryTabs.querySelectorAll('[data-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===key));
    els.status.innerHTML=`Loading <strong>${escapeHtml(cfg.label)}</strong> catalogue…`;
    records=[];groups=[];viewGroups=[];currentPage=0;
    Object.keys(state).forEach(k=>state[k]='');
    els.searchBox.value='';
    for(const f of filterFields) if(filterEls[f]) filterEls[f].value='';
    renderCatalogue();
    try{
      const res=await fetch(encodeURI(cfg.file),{cache:'no-store'});
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const text=await res.text();
      loadCSVText(text,cfg.file);
    }catch(err){
      console.error(err);
      els.status.innerHTML=`<strong>Could not load ${escapeHtml(cfg.file)}.</strong> Make sure this CSV exists inside the data folder.`;
      records=[];groups=[];viewGroups=[];renderCatalogue();
    }
  }

  if(els.csvInput) els.csvInput.addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>loadCSVText(reader.result,file.name);reader.onerror=()=>els.status.innerHTML='<strong>Could not read the selected CSV file.</strong>';reader.readAsText(file,'utf-8')});
  els.searchBox.addEventListener('input',()=>{
    state.q=els.searchBox.value.trim().toLowerCase();
    currentPage=0;
    clearTimeout(globalSearchTimer);
    globalSearchTimer=setTimeout(()=>runGlobalSearch(state.q),140);
  });
  for(const f of filterFields)filterEls[f].addEventListener('change',()=>{syncStateFromUI();currentPage=0;updateAll()});els.moreBtn.addEventListener('click',()=>{const open=els.advancedFilters.classList.toggle('open');els.moreBtn.textContent=open?'Fewer Filters':'More Filters'});els.resetBtn.addEventListener('click',resetAll);
  els.prevBtn.addEventListener('click',()=>{
    if(currentPage>0){
      currentPage--;
      if(document.body.classList.contains('global-search-mode'))renderGlobalSearchResults(state.q);else renderCatalogue();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  });
  els.nextBtn.addEventListener('click',()=>{
    const total=document.body.classList.contains('global-search-mode')?globalSearchResults.length:viewGroups.length;
    const pages=Math.ceil(total/getPageSize());
    if(currentPage<pages-1){
      currentPage++;
      if(document.body.classList.contains('global-search-mode'))renderGlobalSearchResults(state.q);else renderCatalogue();
      window.scrollTo({top:0,behavior:'smooth'});
    }
  });els.closeBtn.addEventListener('click',closeDetail);els.modal.addEventListener('click',e=>{if(e.target===els.modal)closeDetail()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&els.modal.classList.contains('open'))closeDetail()});
  window.addEventListener('resize',()=>{
    currentPage=0;
    if(document.body.classList.contains('global-search-mode'))renderGlobalSearchResults(state.q);else renderCatalogue();
  });
  window.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drop-highlight')});window.addEventListener('dragleave',e=>{if(e.clientX===0&&e.clientY===0)document.body.classList.remove('drop-highlight')});window.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drop-highlight');const file=[...(e.dataTransfer?.files||[])].find(f=>/\.csv$/i.test(f.name));if(!file)return;const reader=new FileReader();reader.onload=()=>loadCSVText(reader.result,file.name);reader.readAsText(file,'utf-8')});
  els.categoryTabs.querySelectorAll('[data-category]').forEach(btn=>btn.addEventListener('click',()=>loadCategory(btn.dataset.category)));
  initKeusFilterSelects();

  const productTrigger=$('keusProductTrigger');
  if(productTrigger)productTrigger.addEventListener('click',e=>{
    e.stopPropagation();
    closeAllKeusFilterMenus();
    const menu=$('keusProductMenu');
    if(menu&&menu.hidden)openKeusProductMenu();else closeKeusProductMenu();
  });
  document.addEventListener('click',e=>{
    const productWrap=$('keusProductSelect');
    if(productWrap&&!productWrap.contains(e.target))closeKeusProductMenu();
    if(!e.target.closest('.keus-filter-select'))closeAllKeusFilterMenus();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeKeusProductMenu();
      closeAllKeusFilterMenus();
    }
  });

  const headerSearchBtn=$('headerSearchBtn');
  if(headerSearchBtn) headerSearchBtn.addEventListener('click',()=>{
    els.searchBox.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>els.searchBox.focus(),260);
  });
  renderCatalogue();loadCategory('downlights');
})();



(function(){
  const loader=document.getElementById('keusPageLoader');
  if(!loader)return;
  let hidden=false;
  const hideLoader=()=>{
    if(hidden)return;
    hidden=true;
    requestAnimationFrame(()=>{
      loader.classList.add('is-hidden');
      setTimeout(()=>loader.remove(),320);
    });
  };
  if(document.readyState==='complete')setTimeout(hideLoader,120);
  else window.addEventListener('load',()=>setTimeout(hideLoader,120),{once:true});
  setTimeout(hideLoader,3500);
})();
