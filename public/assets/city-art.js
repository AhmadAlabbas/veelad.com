/* Veelad city identities – first-party, original, editable vector artwork.
   Named monuments are intentionally hand-drawn for the city listed.
   Other cities receive a clearly typographic identity, not a fake landmark.
   No external images, logos, fonts, scripts or remote URLs. */
(function(){
'use strict';
const landmarkNames=Object.freeze({
 'London':'Elizabeth Tower (Big Ben)',
 'Riyadh':'Kingdom Centre',
 'Tokyo':'Tokyo Skytree',
 'Dubai':'Burj Khalifa',
 'Paris':'Eiffel Tower',
 'New York':'Statue of Liberty',
 'Makkah':'Kaaba',
 'Madinah':'Prophet’s Mosque',
 'Istanbul':'Mosque domes',
 'Rome':'Colosseum',
 'Sydney':'Sydney Opera House',
 'San Francisco':'Golden Gate Bridge',
 'Singapore':'Marina Bay Sands',
 'Shanghai':'Oriental Pearl Tower',
 'Toronto':'CN Tower',
 'Cairo':'Giza pyramids',
 'Giza':'Giza pyramids',
 'Beijing':'Chinese imperial roofline',
 'Berlin':'Brandenburg Gate',
 'Agra':'Taj Mahal',
 'Kyoto':'Japanese pagoda',
 'Rio de Janeiro':'Christ the Redeemer',
 'Venice':'Venetian gondola',
 'Amsterdam':'Canal houses',
 'Athens':'Parthenon',
 'Barcelona':'Sagrada Família-inspired basilica',
 'Seattle':'Space Needle',
 'Washington DC':'Capitol dome',
 'Kuala Lumpur':'Petronas Towers',
 'Hong Kong':'Victoria Harbour skyline',
 'Doha':'Tornado Tower'
});
// All path data below are authored for Veelad. SVG colour inputs are already
// validated as six-digit hexadecimal by the parent element renderer.
const renderers=Object.freeze({
 'London':(p,s,a)=>'<path d="M42 216H216" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M88 214V69h20V50h40v19h20v145Z"/><path fill="'+s+'" d="M103 90h50v54h-50z"/><circle cx="128" cy="117" r="21" fill="'+s+'" stroke="'+p+'" stroke-width="5"/><path d="M128 100v17l12 8" fill="none" stroke="'+p+'" stroke-width="5" stroke-linecap="round"/><path d="M99 52l29-31 29 31Z" fill="'+a+'"/><path d="M128 22V10" stroke="'+p+'" stroke-width="7"/><path fill="'+p+'" d="M66 184h22v30H66zm102-20h22v50h-22z"/><g fill="'+s+'"><rect x="116" y="162" width="9" height="17"/><rect x="131" y="162" width="9" height="17"/></g>',
 'Riyadh':(p,s,a)=>'<path d="M40 219h176" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M84 219 94 47h24l10 51 10-51h24l10 172Z"/><path fill="'+s+'" d="M103 52q25 48 50 0l-6 63h-38Z"/><path fill="'+a+'" d="M107 117h42v11h-42Z"/><g fill="'+s+'"><rect x="104" y="143" width="12" height="9"/><rect x="124" y="143" width="12" height="9"/><rect x="144" y="143" width="12" height="9"/><rect x="105" y="163" width="12" height="9"/><rect x="125" y="163" width="12" height="9"/><rect x="145" y="163" width="12" height="9"/></g><path d="M110 190h37" stroke="'+a+'" stroke-width="8"/>',
 'Tokyo':(p,s,a)=>'<path d="M43 220h170" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="m128 13 7 51 24 156h-62l24-156Z"/><path d="M128 20v204M104 177h48M109 149h38M113 124h30M117 97h22M121 70h14M98 201h60" stroke="'+s+'" stroke-width="6" fill="none"/><path d="m115 95 25 30m-28 0 31 33m-37 2 41 37m-7-101-25 29m28 2-31 31m36 2-41 37" stroke="'+a+'" stroke-width="5" fill="none"/><path fill="'+a+'" d="M94 142h68v11H94zM109 87h38v8h-38Z"/><path d="M124 13h8" stroke="'+a+'" stroke-width="5"/>',
 'Dubai':(p,s,a)=>'<path d="M38 221h181" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M117 220V95h-13v35H91v90Zm22 0V95h13v35h13v90Zm-16 0V38h10v182Z"/><path fill="'+p+'" d="M113 75h30v145h-30Z"/><path d="M128 38V12" stroke="'+p+'" stroke-width="7"/><path fill="'+a+'" d="M105 128h46v11h-46Z"/><g stroke="'+s+'" stroke-width="5"><path d="M122 93v16m13-16v16M122 150v16m13-16v16M122 181v17m13-17v17"/></g><path fill="'+s+'" d="M62 190h24v30H62zm108-44h23v74h-23z"/>',
 'Paris':(p,s,a)=>'<path d="M34 224h188" stroke="'+a+'" stroke-width="9"/><path d="M125 25h6l-9 52-26 90-31 55m66-197-9 52 26 90 34 55" fill="none" stroke="'+p+'" stroke-width="14" stroke-linejoin="round"/><path d="M111 80h36M94 136h70M75 184h106M65 222q62-50 125 0M128 12v17" fill="none" stroke="'+a+'" stroke-width="8" stroke-linecap="round"/><path d="m109 88 40 40m-45 0 40-40m-52 56 68 35m-62 0 60-35" fill="none" stroke="'+p+'" stroke-width="6"/><circle cx="128" cy="11" r="6" fill="'+a+'"/>',
 'New York':(p,s,a)=>'<path d="M42 221h175" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M112 205 95 167l14-36 23-10 27 12 15 73Zm14-88V81h15v36Z"/><circle cx="134" cy="67" r="19" fill="'+p+'"/><path d="m114 55-9-8m21 1-1-13m19 13 10-10m-7 23 16-4m-32-13-9-8" stroke="'+a+'" stroke-width="8" stroke-linecap="round"/><path d="M115 127 92 67 79 55" fill="none" stroke="'+p+'" stroke-width="14" stroke-linecap="round"/><path fill="'+a+'" d="M66 43h26l-6-14H72Z"/><path d="M73 30V18" stroke="'+a+'" stroke-width="7"/><rect x="157" y="139" width="27" height="44" fill="'+s+'" stroke="'+p+'" stroke-width="5"/><path d="M94 204h85v16H94Z" fill="'+a+'"/>',
 'Makkah':(p,s,a)=>'<path d="M41 224h177" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="m68 95 116-12 1 112-116 12Z"/><path fill="'+s+'" d="m68 95 42-22 116 6-42 4Z"/><path d="m69 127 115-11m-115 12 0 13m115-25 0 13" stroke="'+a+'" stroke-width="12"/><path d="m110 74-1 121m-40-12 116-6" stroke="'+s+'" stroke-width="5"/><path fill="'+a+'" d="m110 122 17-2 0 18-17 2Z"/>',
 'Madinah':(p,s,a)=>'<path d="M25 222h206" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M43 155h170v66H43Z"/><path fill="'+a+'" d="M91 156q0-70 37-70 37 0 37 70Z"/><path d="M128 87V58" stroke="'+p+'" stroke-width="7"/><circle cx="128" cy="52" r="7" fill="'+a+'"/><path fill="'+p+'" d="M51 60h15v95H51zm138 0h15v95h-15z"/><path d="m48 61 10-35 11 35m117 0 11-35 11 35" fill="'+a+'"/><g fill="'+s+'"><rect x="65" y="173" width="19" height="48" rx="9"/><rect x="103" y="173" width="18" height="48" rx="9"/><rect x="140" y="173" width="18" height="48" rx="9"/><rect x="176" y="173" width="18" height="48" rx="9"/></g>',
 'Istanbul':(p,s,a)=>'<path d="M26 223h204" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M56 162h144v60H56Z"/><path fill="'+a+'" d="M73 162q7-77 55-77 48 0 55 77Z"/><path fill="'+s+'" d="M89 158q9-56 39-56 30 0 39 56Z"/><path fill="'+p+'" d="M39 56h12v167H39zm166 0h12v167h-12Z"/><path fill="'+a+'" d="M36 56h18l-9-27Zm166 0h18l-9-27Z"/><circle cx="128" cy="72" r="6" fill="'+a+'"/><path d="M128 66V48" stroke="'+p+'" stroke-width="6"/><g fill="'+s+'"><path d="M87 194a14 14 0 0 1 28 0v28H87Zm56 0a14 14 0 0 1 28 0v28h-28Z"/></g>',
 'Rome':(p,s,a)=>'<path d="M25 225h206" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="m48 116 155-13 11 121H42Z"/><path fill="'+s+'" d="M57 133h25v28H57zm39-5h25v29H96zm39-4h25v29h-25zm40-4h25v30h-25Z"/><path fill="'+s+'" d="M56 187q0-26 25-26v63H56Zm42-4q0-26 25-26v67H98Zm42-4q0-26 25-26v71h-25Zm42-4q0-26 25-26v75h-25Z"/><path d="M49 115q66-37 154-12M48 169h160" stroke="'+a+'" stroke-width="7" fill="none"/>',
 'Sydney':(p,s,a)=>'<path d="M28 218h200" stroke="'+a+'" stroke-width="9"/><path d="M59 207 95 77q28 43 42 115Q93 197 59 207Zm65-3 25-123q41 40 61 112-38 10-86 11Z" fill="'+p+'"/><path d="M46 210Q74 130 96 79m41 111q-4-62 12-109" fill="none" stroke="'+s+'" stroke-width="10"/><path fill="'+a+'" d="M39 209h179v12H39Z"/><path d="M35 237q13-13 26 0 13 13 26 0 13-13 26 0 13 13 26 0 13-13 26 0" stroke="'+p+'" stroke-width="6" fill="none"/>',
 'San Francisco':(p,s,a)=>'<path d="M15 222h227" stroke="'+a+'" stroke-width="8"/><path d="M55 215V59m147 156V59" stroke="'+p+'" stroke-width="13"/><path d="M18 147h220" stroke="'+a+'" stroke-width="13"/><path d="M55 69Q128 160 202 69" fill="none" stroke="'+p+'" stroke-width="8"/><path d="M55 74v73m22-41v41m25-23v23m26-14v14m26-14v14m25-22v22m23-41v41" fill="none" stroke="'+p+'" stroke-width="4"/><path d="M48 58h14M195 58h14" stroke="'+a+'" stroke-width="7"/>',
 'Singapore':(p,s,a)=>'<path d="M27 221h202" stroke="'+a+'" stroke-width="8"/><g fill="'+p+'"><path d="M53 100h38v121H53zM108 100h38v121h-38zM163 100h38v121h-38z"/></g><path d="M35 88q93-55 186 0l-11 17H45Z" fill="'+a+'"/><path d="M66 125v68m55-68v68m55-68v68" stroke="'+s+'" stroke-width="7"/><path d="M55 75h147" stroke="'+p+'" stroke-width="8" stroke-linecap="round"/>',
 'Shanghai':(p,s,a)=>'<path d="M37 222h183" stroke="'+a+'" stroke-width="9"/><path d="M128 18v203" stroke="'+p+'" stroke-width="12"/><path d="M104 221 128 90l24 131" fill="none" stroke="'+p+'" stroke-width="11"/><circle cx="128" cy="133" r="37" fill="'+a+'" stroke="'+p+'" stroke-width="7"/><circle cx="128" cy="57" r="18" fill="'+s+'" stroke="'+p+'" stroke-width="7"/><path d="M85 174h86M100 213h55" stroke="'+p+'" stroke-width="9"/>',
 'Toronto':(p,s,a)=>'<path d="M35 224h184" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M123 21h10v203h-10Z"/><path fill="'+p+'" d="m111 118-11 106h56l-11-106Z"/><ellipse cx="128" cy="113" rx="44" ry="15" fill="'+a+'"/><path fill="'+p+'" d="M86 112q42-24 84 0v9q-42 20-84 0Z"/><path d="M128 21V10" stroke="'+a+'" stroke-width="8"/>',
 'Cairo':(p,s,a)=>'<path d="M25 221h206" stroke="'+a+'" stroke-width="9"/><path d="m35 211 66-110 66 110Zm105 0 42-70 44 70Z" fill="'+p+'"/><path d="m101 101 66 110m-125 0 59-98" stroke="'+s+'" stroke-width="6" fill="none"/><circle cx="191" cy="65" r="21" fill="'+a+'"/>',
 'Giza':(p,s,a)=>renderers.Cairo(p,s,a),
 'Beijing':(p,s,a)=>'<path d="M26 220h204" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M46 150h164v70H46Z"/><path fill="'+a+'" d="m34 146 94-53 95 53-13 16H46Z"/><path fill="'+p+'" d="m67 93 61-43 61 43-8 17H75Z"/><path fill="'+a+'" d="M115 31h26v25h-26Z"/><g fill="'+s+'"><rect x="73" y="177" width="23" height="43"/><rect x="117" y="177" width="22" height="43"/><rect x="159" y="177" width="23" height="43"/></g>',
 'Berlin':(p,s,a)=>'<path d="M28 222h200" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M42 91h172v21H42Z"/><path fill="'+a+'" d="m35 86 93-34 94 34v12H35Z"/><path fill="'+p+'" d="M53 111h18v110H53Zm43 0h18v110H96Zm46 0h18v110h-18Zm43 0h18v110h-18Z"/><path d="M40 192h175" stroke="'+s+'" stroke-width="7"/><path d="M112 50q16-27 31 0" stroke="'+p+'" stroke-width="9" fill="none"/>',
 'Agra':(p,s,a)=>'<path d="M26 222h204" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M53 151h150v71H53Z"/><path fill="'+a+'" d="M81 151q5-65 47-65 42 0 47 65Z"/><path d="M128 86V61" stroke="'+p+'" stroke-width="7"/><path fill="'+p+'" d="M38 92h14v129H38zm166 0h14v129h-14Z"/><path fill="'+a+'" d="M35 92h20l-10-30Zm166 0h20l-10-30Z"/><path fill="'+s+'" d="M109 182q19-31 38 0v40h-38Z"/>',
 'Kyoto':(p,s,a)=>'<path d="M25 222h205" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M91 88h74v134H91Z"/><path fill="'+a+'" d="m39 104 89-50 89 50-19 11H58Zm11 45 78-42 79 42-18 10H68Zm14 48 64-31 65 31-15 9H79Z"/><path fill="'+p+'" d="M121 35h14v22h-14Z"/><path fill="'+s+'" d="M115 175h27v47h-27Z"/>',
 'Rio de Janeiro':(p,s,a)=>'<path d="M26 225h204" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="m85 218 23-57 20-13 20 13 23 57Z"/><path d="M128 82v92m-69-54h138" stroke="'+p+'" stroke-width="19" stroke-linecap="round"/><circle cx="128" cy="65" r="19" fill="'+p+'"/><path d="M92 219q18-28 36-28 18 0 36 28" fill="'+a+'"/>',
 'Venice':(p,s,a)=>'<path d="M24 201q22-8 45 0t45 0t45 0t45 0t30 0" stroke="'+a+'" stroke-width="7" fill="none"/><path fill="'+p+'" d="M36 159h172q-17 41-89 41-65 0-83-41Z"/><path d="M73 154 110 54l18 101M110 54l51 101" fill="none" stroke="'+p+'" stroke-width="9"/><path fill="'+s+'" d="m112 61-25 90h57Z"/><path d="M25 224q25-11 48 0t48 0t48 0t60 0" stroke="'+a+'" stroke-width="7" fill="none"/>',
 'Amsterdam':(p,s,a)=>'<path d="M28 224h202" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M35 110h53v110H35Zm66-31h53v141h-53Zm66 25h53v116h-53Z"/><path fill="'+a+'" d="m32 110 29-26 30 26Zm66-31 29-39 30 39Zm66 25 30-27 29 27Z"/><g fill="'+s+'"><rect x="51" y="135" width="14" height="23"/><rect x="116" y="105" width="15" height="26"/><rect x="183" y="129" width="15" height="26"/><rect x="51" y="174" width="14" height="23"/><rect x="116" y="151" width="15" height="24"/><rect x="183" y="170" width="15" height="24"/></g><path d="M25 236q22-9 45 0t45 0t45 0t50 0" stroke="'+p+'" stroke-width="5" fill="none"/>',
 'Athens':(p,s,a)=>'<path d="M28 222h199" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M37 93h182v18H37Zm-5 114h193v16H32Z"/><path fill="'+a+'" d="m42 88 86-48 86 48Z"/><g fill="'+p+'"><rect x="55" y="110" width="18" height="99"/><rect x="96" y="110" width="18" height="99"/><rect x="140" y="110" width="18" height="99"/><rect x="182" y="110" width="18" height="99"/></g><path d="M50 124h151" stroke="'+s+'" stroke-width="5"/>',
 'Barcelona':(p,s,a)=>'<path d="M25 222h205" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M63 119h130v103H63Z"/><path fill="'+a+'" d="m77 119 11-82 11 82Zm40 0 11-110 11 110Zm40 0 11-78 11 78Z"/><path d="M88 37V25m40-16V3m40 38V27" stroke="'+p+'" stroke-width="5"/><g fill="'+s+'"><path d="M108 167q20-27 40 0v55h-40Z"/><circle cx="86" cy="149" r="9"/><circle cx="170" cy="149" r="9"/></g>',
 'Seattle':(p,s,a)=>'<path d="M29 222h200" stroke="'+a+'" stroke-width="8"/><path d="M128 68V220" stroke="'+p+'" stroke-width="11"/><path fill="'+p+'" d="m73 219 55-72 55 72Z"/><path d="M44 96q84 38 168 0-84-17-168 0Z" fill="'+a+'"/><ellipse cx="128" cy="90" rx="84" ry="14" fill="'+p+'"/><path d="M128 72V24" stroke="'+p+'" stroke-width="6"/><path d="m117 42 11-18 12 18" stroke="'+a+'" stroke-width="5" fill="none"/>',
 'Washington DC':(p,s,a)=>'<path d="M27 222h201" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M42 152h172v70H42Z"/><path fill="'+a+'" d="M80 152q0-72 48-72 48 0 48 72Z"/><path d="M128 80V52" stroke="'+p+'" stroke-width="8"/><circle cx="128" cy="46" r="7" fill="'+a+'"/><path fill="'+s+'" d="M57 172h17v50H57zm35 0h17v50H92zm36 0h17v50h-17zm35 0h17v50h-17Zm35 0h12v50h-12Z"/>',
 'Kuala Lumpur':(p,s,a)=>'<path d="M27 223h202" stroke="'+a+'" stroke-width="9"/><path fill="'+p+'" d="M71 68h40v154H71zm75 0h40v154h-40Z"/><path d="M91 68V28m75 40V28" stroke="'+p+'" stroke-width="8"/><path fill="'+a+'" d="M109 124h39v13h-39Z"/><path d="M78 87h25m-25 26h25m-25 47h25m-25 26h25m50-99h25m-25 26h25m-25 47h25m-25 26h25" stroke="'+s+'" stroke-width="6"/><path fill="'+p+'" d="M85 25h13l-7-16Zm75 0h13l-7-16Z"/>',
 'Hong Kong':(p,s,a)=>'<path d="M23 223h210" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M44 146h30v76H44zm41-65h42v141H85zm53-28h34v169h-34zm45 75h27v94h-27Z"/><path d="M89 95h33m21-24h24m-75 44h26m25-20h24m-25 23h24" stroke="'+s+'" stroke-width="6"/><path d="M22 237q22-7 44 0t44 0t44 0t44 0t33 0" stroke="'+a+'" stroke-width="5" fill="none"/>',
 'Doha':(p,s,a)=>'<path d="M29 220h199" stroke="'+a+'" stroke-width="8"/><path fill="'+p+'" d="M98 218 80 70h96l-18 148Z"/><path d="M84 94h88M88 124h80M92 154h73M96 187h65" stroke="'+s+'" stroke-width="8"/><path d="M86 83h83m-79 57h75m-68 31h66" stroke="'+a+'" stroke-width="5"/><path fill="'+s+'" d="M40 171h34v47H40zm137-33h38v80h-38Z"/>'
});
function escapeText(value){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function compactCity(city){
 const tokens=city.split(/\s+/).filter(Boolean),short=tokens.length===1?tokens[0].slice(0,3):tokens.slice(0,3).map(t=>t[0]).join('');
 return short.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase();
}
function fallback(city,country,p,s,a){
 // A city-name identity is more honest than recycling an unrelated skyline.
 // The tile pattern and monogram are derived from the name; no landmark claim.
 let hash=2166136261;
 for(const char of city+'|'+country){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619)>>>0;}
 const initials=escapeText(compactCity(city)),title=escapeText(city),countryCode=escapeText(country);
 const offset=36+hash%37,angle=20+hash%40,lines=3+(hash%4),pattern=[];
 for(let i=0;i<lines;i++)pattern.push('<path d="M'+(offset+i*11)+' 30l'+angle+' 34" stroke="'+a+'" stroke-width="4" opacity=".32"/>');
 const sz=city.length>22?17:city.length>16?20:city.length>12?23:27;
 return '<rect x="22" y="28" width="212" height="197" rx="27" fill="'+s+'" opacity=".42"/>'+
  '<g>'+pattern.join('')+'</g><circle cx="128" cy="117" r="65" fill="'+p+'"/>'+
  '<text x="128" y="139" text-anchor="middle" font-weight="800" font-size="'+(initials.length>3?58:70)+'" font-family="Arial, sans-serif" fill="'+s+'">'+initials+'</text>'+
  '<text x="128" y="196" font-family="Arial,sans-serif" font-size="'+sz+'" font-weight="700" text-anchor="middle" fill="'+p+'">'+title+'</text>'+
  '<text x="128" y="218" font-family="Arial,sans-serif" font-size="14" letter-spacing="2" font-weight="600" text-anchor="middle" fill="'+a+'">'+countryCode+'</text>';
}
function draw(city,country,colors){
 const p=colors.primary,s=colors.secondary,a=colors.accent;
 const shape=renderers[city];
 if(!shape)return fallback(city,country,p,s,a);
 // A restrained secondary halo grounds each unique landmark without masking it.
 return '<circle cx="128" cy="135" r="91" fill="'+s+'" opacity=".48"/>'+shape(p,s,a);
}
window.VeeladCityArt=Object.freeze({draw,landmarkNames,namedLandmark(city){return landmarkNames[city]||null;},compactCity});
})();