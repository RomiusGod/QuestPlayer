/*! QuestPlayer — модуль движка Glulx.
 *
 *  GlkOte 2.3.7, Quixe 2.2.6, Glk 2.3.7, Dialog, Blorb, GiDispa, GiLoad —
 *  © Andrew Plotkin (MIT). Перенесено из QuestPlayer.html без изменений
 *  логики: только обёртка IIFE и контракт window.GlulxEngine.
 *
 *  Модуль не знает про интерфейс, палитру, i18n, кнопки и сейвы приложения.
 *  Он трогает только #gameport/#windowport (через GlkOte) и возвращает
 *  управление колбэками. Контракт: engines/README.md
 */
(function () {
'use strict';

var GlkOteClass=function(){let is_inited=false;let game_interface=null;let dom_context=undefined;let dom_prefix='';let localization_map={};let windowport_id='windowport';let gameport_id='gameport';let errorpane_id='errorpane';let errorcontent_id='errorcontent';let loadingpane_id='loadingpane';let max_buffer_length=800;let generation=0;let generation_sent=-1;let disabled=false;let loading_visible=null;let error_visible=false;let windowdic=null;let current_metrics=null;let current_devpixelratio=null;let current_viewportheight=null;let orig_gameport_margins=null;let last_known_focus=0;let last_known_paging=0;let windows_paging_count=0;const graphics_draw_queue=[];let request_timer=null;let request_timer_interval=null;let resize_timer=null;let arrange_retries=0;let retry_timer=null;let is_mobile=false;const perform_paging=true;let detect_external_links=false;let regex_external_links=null;let debug_out_handler=null;let Dialog=null;let Blorb=null;const NBSP='\xa0';const ZWJ='\u200D';const approx_scroll_width=20;const moreprompt_margin=4;const inputel_minwidth=200;const key_codes={KEY_BACKSPACE:8,KEY_TAB:9,KEY_RETURN:13,KEY_ESC:27,KEY_LEFT:37,KEY_UP:38,KEY_RIGHT:39,KEY_DOWN:40,KEY_DELETE:46,KEY_HOME:36,KEY_END:35,KEY_PAGEUP:33,KEY_PAGEDOWN:34,KEY_INSERT:45};const terminator_key_names={escape:key_codes.KEY_ESC,func1:112,func2:113,func3:114,func4:115,func5:116,func6:117,func7:118,func8:119,func9:120,func10:121,func11:122,func12:123};const terminator_key_values={};let recording=false;let recording_state=null;let recording_handler=null;let recording_handler_url=null;const recording_context={};const image_cache={};function glkote_init(iface){if(!iface&&window.Game)
iface=window.Game;if(!iface){glkote_error('No game interface object has been provided.');return;}
if(!iface.accept){glkote_error('The game interface object must have an accept() function.');return;}
game_interface=iface;if(!window.jQuery||!jQuery.fn.jquery){glkote_error('The jQuery library has not been loaded.');return;}
const version=jQuery.fn.jquery.split('.');if(version.length<2||version[0]<1||(version[0]==1&&version[1]<9)){glkote_error('This version of the jQuery library is too old. (Version '+jQuery.fn.jquery+' found; 1.9.0 required.)');return;}
for(const val in terminator_key_names){terminator_key_values[terminator_key_names[val]]=val;}
is_mobile=('ontouchstart'in window);windowdic=new Map();if(iface.localize)
localization_map=iface.localize;if(iface.dom_prefix)
dom_prefix=iface.dom_prefix;if(iface.windowport)
windowport_id=iface.windowport;if(iface.gameport)
gameport_id=iface.gameport;if(iface.errorpane)
errorpane_id=iface.errorpane;if(iface.errorcontent)
errorcontent_id=iface.errorcontent;if(iface.loadingpane)
loadingpane_id=iface.loadingpane;const el=$('#'+windowport_id,dom_context);if(!el.length){glkote_error('Cannot find windowport element #'+windowport_id+' in this document.');return;}
el.empty();if(perform_paging)
$(document).on('keypress',evhan_doc_keypress);$(window).on('resize',evhan_doc_resize);current_devpixelratio=window.devicePixelRatio||1;const gameport=$('#'+gameport_id,dom_context);const gameparent=gameport.offsetParent();orig_gameport_margins={top:gameport.offset().top,bottom:$(window).height()-(gameport.offset().top+gameport.outerHeight()),parenttop:gameparent.offset().top,};if(window.matchMedia){window.matchMedia('screen and (min-resolution: 1.5dppx)').addListener(evhan_doc_pixelreschange);window.matchMedia('screen and (min-resolution: 2dppx)').addListener(evhan_doc_pixelreschange);window.matchMedia('screen and (min-resolution: 3dppx)').addListener(evhan_doc_pixelreschange);window.matchMedia('screen and (min-resolution: 4dppx)').addListener(evhan_doc_pixelreschange);}
const res=measure_window();if(jQuery.type(res)==='string'){glkote_error(res);return;}
current_metrics=res;create_resize_sensor();if(iface.max_buffer_length)
max_buffer_length=iface.max_buffer_length;detect_external_links=iface.detect_external_links;if(detect_external_links){regex_external_links=iface.regex_external_links;if(!regex_external_links){if(detect_external_links=='search'){regex_external_links=RegExp('\\b((?:https?://)(?:[^\\s()<>]+|\\(([^\\s()<>]+|(\\([^\\s()<>]+\\)))*\\))+(?:\\(([^\\s()<>]+|(\\([^\\s()<>]+\\)))*\\)|[^\\s`!()\\[\\]{};:\'".,<>?\u00ab\u00bb\u201c\u201d\u2018\u2019]))','i');}
else{regex_external_links=RegExp('^https?:','i');}}}
if(iface.recording_url){recording=true;recording_handler=recording_standard_handler;recording_handler_url=iface.recording_url;}
if(iface.recording_handler){recording=true;recording_handler=iface.recording_handler;recording_handler_url='(custom handler)';}
if(recording){const qparams=get_query_params();const flag=qparams['feedback'];if(jQuery.type(flag)!='undefined'&&flag!='1'){recording=false;glkote_log('User has opted out of transcript recording.');}
else{let sessionid=null;try{sessionid=crypto.randomUUID();}
catch(ex){sessionid=(new Date().getTime())+''+(Math.ceil(Math.random()*10000));}
recording_state={sessionId:sessionid,input:null,output:null,timestamp:0,outtimestamp:0};if(iface.recording_label)
recording_state.label=iface.recording_label;if(iface.recording_format=='simple')
recording_state.format='simple';else
recording_state.format='glkote';glkote_log('Transcript recording active: session '+recording_state.sessionId+' "'+recording_state.label+'", destination '+recording_handler_url);}}
if(iface.debug_commands){let debugmod=window.GiDebug;if(iface.debug_commands!=true)
debugmod=iface.debug_commands;if(!debugmod){glkote_log('The debug_commands option is set, but there is no GiDebug module.');}
else{debugmod.init(evhan_debug_command);debug_out_handler=debugmod.output;if(iface.debug_console_open)
debugmod.open();}}
if(iface.Blorb){Blorb=iface.Blorb;}
if(iface.Dialog){Dialog=iface.Dialog;}
else if(window.DialogClass){Dialog=new window.DialogClass();}
if(Dialog&&!Dialog.inited()){const dialogiface={GlkOte:this};if(iface.dialog_dom_prefix){dialogiface.dom_prefix=iface.dialog_dom_prefix;}
if(iface.localize){dialogiface.localize=iface.localize;}
if(Dialog.init_async){Dialog.init_async(dialogiface,function(){finish_init(iface);});return;}
else if(Dialog.init){Dialog.init(dialogiface);}}
finish_init(iface);}
function finish_init(iface){is_inited=true;if(!iface.font_load_delay){send_response('init',null,current_metrics);}
else{disabled=true;defer_func(function(){disabled=false;current_metrics=measure_window();send_response('init',null,current_metrics);});}}
function glkote_inited(){return is_inited;}
function measure_window(){const metrics={};const gameport=$('#'+gameport_id,dom_context);if(!gameport.length)
return'Cannot find gameport element #'+gameport_id+' in this document.';$('#'+dom_prefix+'layouttestpane',dom_context).remove();metrics.width=Math.max(0,gameport.width()-1);metrics.height=Math.max(0,gameport.height()-1);const layout_test_pane=$('<div>',{id:dom_prefix+'layout_test_pane'});layout_test_pane.text('This should not be visible');layout_test_pane.css({position:'absolute',visibility:'hidden',left:'-1000px'});const line=$('<div>');line.append($('<span>',{'class':'Style_normal'}).text('12345678'));const gridwin=$('<div>',{'class':'WindowFrame GridWindow'});const gridline1=line.clone().addClass('GridLine').appendTo(gridwin);const gridline2=line.clone().addClass('GridLine').appendTo(gridwin);const gridspan=gridline1.children('span');layout_test_pane.append(gridwin);const bufwin=$('<div>',{'class':'WindowFrame BufferWindow'});const bufline1=line.clone().addClass('BufferLine').appendTo(bufwin);const bufline2=line.clone().addClass('BufferLine').appendTo(bufwin);const invcurspan=$('<span>',{'class':'InvisibleCursor'});bufline2.append(invcurspan);const bufspan=bufline1.children('span');layout_test_pane.append(bufwin);const graphwin=$('<div>',{'class':'WindowFrame GraphicsWindow'});const graphcanvas=$('<canvas>');graphcanvas.attr('width',64);graphcanvas.attr('height',32);graphwin.append(graphcanvas);layout_test_pane.append(graphwin);gameport.append(layout_test_pane);function get_size(el){return{width:el.outerWidth(),height:el.outerHeight()};}
let winsize=get_size(gridwin);let spansize=get_size(gridspan);let line1size=get_size(gridline1);let line2size=get_size(gridline2);metrics.gridcharheight=Math.max(1,gridline2.position().top-gridline1.position().top);metrics.gridcharwidth=Math.max(1,gridspan.width()/8);metrics.gridmarginx=winsize.width-spansize.width;metrics.gridmarginy=winsize.height-(line1size.height+line2size.height);winsize=get_size(bufwin);spansize=get_size(bufspan);line1size=get_size(bufline1);line2size=get_size(bufline2);metrics.buffercharheight=Math.max(1,bufline2.position().top-bufline1.position().top);metrics.buffercharwidth=Math.max(1,bufspan.width()/8);metrics.buffermarginx=winsize.width-spansize.width;metrics.buffermarginy=winsize.height-(line1size.height+line2size.height)+2;winsize=get_size(graphwin);const canvassize=get_size(graphcanvas);metrics.graphicsmarginx=winsize.width-canvassize.width;metrics.graphicsmarginy=winsize.height-canvassize.height;layout_test_pane.remove();metrics.outspacingx=0;metrics.outspacingy=0;metrics.inspacingx=0;metrics.inspacingy=0;if(game_interface.spacing!=undefined){metrics.outspacingx=game_interface.spacing;metrics.outspacingy=game_interface.spacing;metrics.inspacingx=game_interface.spacing;metrics.inspacingy=game_interface.spacing;}
if(game_interface.outspacing!=undefined){metrics.outspacingx=game_interface.outspacing;metrics.outspacingy=game_interface.outspacing;}
if(game_interface.inspacing!=undefined){metrics.inspacingx=game_interface.inspacing;metrics.inspacingy=game_interface.inspacing;}
if(game_interface.inspacingx!=undefined)
metrics.inspacingx=game_interface.inspacingx;if(game_interface.inspacingy!=undefined)
metrics.inspacingy=game_interface.inspacingy;if(game_interface.outspacingx!=undefined)
metrics.outspacingx=game_interface.outspacingx;if(game_interface.outspacingy!=undefined)
metrics.outspacingy=game_interface.outspacingy;return metrics;}
function metrics_match(met1,met2){if(met1.width!=met2.width)
return false;if(met1.height!=met2.height)
return false;if(met1.gridcharwidth!=met2.gridcharwidth)
return false;if(met1.gridcharheight!=met2.gridcharheight)
return false;if(met1.buffercharwidth!=met2.buffercharwidth)
return false;if(met1.buffercharheight!=met2.buffercharheight)
return false;return true;}
function create_resize_sensor(){const gameport=$('#'+gameport_id,dom_context);if(!gameport.length){console.log('Cannot find gameport element #'+gameport_id+' in this document.');return;}
function evhan(ents){evhan_doc_resize();}
try{let observer=new ResizeObserver(evhan);observer.observe(gameport.get(0));}catch(ex){console.log('ResizeObserver is not available in this browser.');}
if(is_mobile&&window.visualViewport){$(visualViewport).on('resize',evhan_viewport_resize);}}
function glkote_update(arg){hide_loading();let autorestore=null;if(arg.autorestore&&generation==0)
autorestore=arg.autorestore;if(recording&&!autorestore){recording_send(arg);}
if(arg.debugoutput&&debug_out_handler){debug_out_handler(arg.debugoutput);}
if(arg.type=='error'){glkote_error(arg.message);return;}
if(arg.type=='pass'){return;}
if(arg.type=='retry'){if(!retry_timer){glkote_log('Event has timed out; will retry...');show_loading();retry_timer=delay_func(2,retry_update);}
else{glkote_log('Event has timed out, but a retry is already queued!');}
return;}
if(arg.type!='update'){glkote_log('Ignoring unknown message type '+arg.type+'.');return;}
if(arg.gen==generation){glkote_log('Ignoring repeated generation number: '+generation);return;}
if(arg.gen<generation){glkote_log('Ignoring out-of-order generation number: got '+arg.gen+', currently at '+generation);return;}
generation=arg.gen;if(disabled){for(const win of windowdic.values()){if(win.inputel){win.inputel.prop('disabled',false);}}
disabled=false;}
if(arg.input!=null)
accept_inputcancel(arg.input);if(arg.windows!=null)
accept_windowset(arg.windows);if(arg.content!=null)
accept_contentset(arg.content);if(arg.input!=null)
accept_inputset(arg.input);if(arg.timer!==undefined)
accept_timerrequest(arg.timer);if(arg.specialinput!=null)
accept_specialinput(arg.specialinput);for(const win of windowdic.values()){if(win.type=='buffer'&&win.needscroll){win.needscroll=false;if(!win.needspaging){const frameel=win.frameel;if(!perform_paging){frameel.scrollTop(frameel.get(0).scrollHeight);win.needspaging=false;win.scrolledtoend=true;}
else{frameel.scrollTop(win.topunseen-current_metrics.buffercharheight);const frameheight=frameel.outerHeight();win.scrolledtoend=frameel.scrollTop()+frameheight+moreprompt_margin>=frameel.get(0).scrollHeight;win.pagefrommark=win.topunseen;const realbottom=buffer_last_line_top_offset(win);let newtopunseen=frameel.scrollTop()+frameheight;if(newtopunseen>realbottom)
newtopunseen=realbottom;if(win.topunseen<newtopunseen)
win.topunseen=newtopunseen;if(frameel.scrollTop()+frameheight+moreprompt_margin>=frameel.get(0).scrollHeight){win.needspaging=false;}
else if(frameheight<=current_metrics.buffercharheight){win.needspaging=false;}
else{win.needspaging=true;}}
let moreel=$('#'+dom_prefix+'win'+win.id+'_moreprompt',dom_context);let prevel=$('#'+dom_prefix+'win'+win.id+'_prevmark',dom_context);if(!win.needspaging){if(moreel.length)
moreel.remove();if(prevel.length)
prevel.remove();}
else{if(!moreel.length){moreel=$('<div>',{id:dom_prefix+'win'+win.id+'_moreprompt','class':'MorePrompt'});moreel.text(localize('glkote_more'));const morex=win.coords.right+approx_scroll_width;const morey=win.coords.bottom;moreel.css({bottom:morey+'px',right:morex+'px'});$('#'+windowport_id,dom_context).append(moreel);}
if(!prevel.length){prevel=$('<div>',{id:dom_prefix+'win'+win.id+'_prevmark','class':'PreviousMark'});frameel.prepend(prevel);}
prevel.css('top',(win.pagefrommark+'px'));}}}
else if(win.type=='buffer'){if(win.scrolledtoend){const frameel=win.frameel;frameel.scrollTop(frameel.get(0).scrollHeight);}}}
readjust_paging_focus(false);disabled=false;if(arg.disable||arg.specialinput){disabled=true;for(const win of windowdic.values()){if(win.inputel){win.inputel.prop('disabled',true);}}}
let newinputwin=0;if(!disabled&&!windows_paging_count){for(const win of windowdic.values()){if(win.input){if(!newinputwin||win.id==last_known_focus)
newinputwin=win.id;}}}
if(newinputwin){const win=windowdic.get(newinputwin);if(win.inputel){win.inputel.focus();}}
if(autorestore){if(autorestore.history){for(const[winid,ls]of Object.entries(autorestore.history)){const win=windowdic.get(winid);if(win!=null){win.history=ls.slice(0);win.historypos=win.history.length;}}}
if(autorestore.defcolor){for(const[winid,val]of Object.entries(autorestore.defcolor)){const win=windowdic.get(winid);if(win!=null){win.defcolor=val;}}}
if(autorestore.recording_sessionid){if(recording&&recording_state){recording_state.sessionId=autorestore.recording_sessionid;glkote_log('Transcript recording restored: session '+recording_state.sessionId+' "'+recording_state.label+'", destination '+recording_handler_url);}}
for(const win of windowdic.values()){if(win.type=='buffer'){window_scroll_to_bottom(win);}}
if(!(autorestore.metrics&&autorestore.metrics.width==current_metrics.width&&autorestore.metrics.height==current_metrics.height)){current_metrics.width+=2;evhan_doc_resize();}}}
function accept_windowset(arg){for(const win of windowdic.values()){win.inplace=false;}
arg.forEach(accept_one_window);const closewins=[];for(const win of windowdic.values()){if(!win.inplace){closewins.push(win);}}
for(const win of closewins){close_one_window(win);}}
function accept_one_window(arg){let frameel,win;if(!arg){return;}
win=windowdic.get(arg.id);if(win==null){win={id:arg.id,type:arg.type,rock:arg.rock};windowdic.set(arg.id,win);let typeclass;if(win.type=='grid')
typeclass='GridWindow';if(win.type=='buffer')
typeclass='BufferWindow';if(win.type=='graphics')
typeclass='GraphicsWindow';const rockclass='WindowRock_'+arg.rock;frameel=$('<div>',{id:dom_prefix+'window'+arg.id,'class':'WindowFrame HasNoInputField '+typeclass+' '+rockclass});frameel.data('winid',arg.id);frameel.on('mousedown',arg.id,evhan_window_mousedown);if(perform_paging&&win.type=='buffer')
frameel.on('scroll',arg.id,evhan_window_scroll);if(win.type=='grid'||win.type=='graphics')
frameel.on('click',win.id,evhan_input_mouse_click);if(win.type=='buffer')
frameel.attr({'aria-live':'polite','aria-atomic':'false','aria-relevant':'additions'});win.frameel=frameel;win.gridheight=0;win.gridwidth=0;win.input=null;win.inputel=null;win.terminators={};win.reqhyperlink=false;win.reqmouse=false;win.needscroll=false;win.needspaging=false;win.scrolledtoend=true;win.topunseen=0;win.pagefrommark=0;win.coords={left:null,top:null,right:null,bottom:null};win.history=new Array();win.historypos=0;$('#'+windowport_id,dom_context).append(frameel);}
else{frameel=win.frameel;if(win.type!=arg.type)
glkote_error('Window '+arg.id+' was created with type '+win.type+', but now is described as type '+arg.type);}
win.inplace=true;if(win.type=='grid'){if(arg.gridheight>win.gridheight){for(let ix=win.gridheight;ix<arg.gridheight;ix++){const el=$('<div>',{id:dom_prefix+'win'+win.id+'_ln'+ix,'class':'GridLine'});el.append(NBSP);win.frameel.append(el);}}
if(arg.gridheight<win.gridheight){for(let ix=arg.gridheight;ix<win.gridheight;ix++){const el=$('#'+dom_prefix+'win'+win.id+'_ln'+ix,dom_context);if(el.length)
el.remove();}}
win.gridheight=arg.gridheight;win.gridwidth=arg.gridwidth;}
if(win.type=='buffer'){}
if(win.type=='graphics'){let el=$('#'+dom_prefix+'win'+win.id+'_canvas',dom_context);if(!el.length){win.graphwidth=arg.graphwidth;win.graphheight=arg.graphheight;win.defcolor='#FFF';el=$('<canvas>',{id:dom_prefix+'win'+win.id+'_canvas'});win.backpixelratio=1;const ctx=canvas_get_2dcontext(el);if(ctx){win.backpixelratio=ctx.webkitBackingStorePixelRatio||ctx.mozBackingStorePixelRatio||ctx.msBackingStorePixelRatio||ctx.oBackingStorePixelRatio||ctx.backingStorePixelRatio||1;}
win.scaleratio=current_devpixelratio/win.backpixelratio;el.attr('width',win.graphwidth*win.scaleratio);el.attr('height',win.graphheight*win.scaleratio);el.css('width',(win.graphwidth+'px'));el.css('height',(win.graphheight+'px'));win.frameel.css('background-color',win.defcolor);if(ctx){ctx.setTransform(win.scaleratio,0,0,win.scaleratio,0,0);}
win.frameel.append(el);}
else{if(win.graphwidth!=arg.graphwidth||win.graphheight!=arg.graphheight){win.graphwidth=arg.graphwidth;win.graphheight=arg.graphheight;el.attr('width',win.graphwidth*win.scaleratio);el.attr('height',win.graphheight*win.scaleratio);el.css('width',(win.graphwidth+'px'));el.css('height',(win.graphheight+'px'));const ctx=canvas_get_2dcontext(el);if(ctx){ctx.setTransform(win.scaleratio,0,0,win.scaleratio,0,0);ctx.fillStyle=win.defcolor;ctx.fillRect(0,0,win.graphwidth,win.graphheight);ctx.fillStyle='#000000';}
win.frameel.css('background-color',win.defcolor);const funcarg=win.id;defer_func(function(){send_window_redraw(funcarg);});}}}
const right=current_metrics.width-(arg.left+arg.width);const bottom=current_metrics.height-(arg.top+arg.height);const styledic={left:arg.left+'px',top:arg.top+'px'};win.coords.left=arg.left;win.coords.top=arg.top;win.coords.right=right;win.coords.bottom=bottom;frameel.css(styledic);frameel.outerWidth(arg.width);frameel.outerHeight(arg.height);}
function close_one_window(win){win.frameel.remove();windowdic.delete(win.id);win.frameel=null;const moreel=$('#'+dom_prefix+'win'+win.id+'_moreprompt',dom_context);if(moreel.length)
moreel.remove();}
function accept_contentset(arg){arg.forEach(accept_one_content);}
function accept_one_content(arg){const win=windowdic.get(arg.id);if(win==null){glkote_error('Got content update for window '+arg.id+', which does not exist.');return;}
if(win.input&&win.input.type=='line'){glkote_error('Got content update for window '+arg.id+', which is awaiting line input.');return;}
win.needscroll=true;if(win.type=='grid'){const lines=arg.lines;for(let ix=0;ix<lines.length;ix++){const linearg=lines[ix];const linenum=linearg.line;const content=linearg.content;const lineel=$('#'+dom_prefix+'win'+win.id+'_ln'+linenum,dom_context);if(!lineel.length){glkote_error('Got content for nonexistent line '+linenum+' of window '+arg.id+'.');continue;}
if(!content||!content.length){lineel.text(NBSP);}
else{lineel.empty();for(let sx=0;sx<content.length;sx++){const rdesc=content[sx];let rstyle,rtext,rlink;if(jQuery.type(rdesc)==='object'){if(rdesc.special!==undefined)
continue;rstyle=rdesc.style;rtext=rdesc.text;rlink=rdesc.hyperlink;}
else{rstyle=rdesc;sx++;rtext=content[sx];rlink=undefined;}
const el=$('<span>',{'class':'Style_'+rstyle});if(rlink==undefined){insert_text_detecting(el,rtext);}
else{const ael=$('<a>',{'href':'#','class':'Internal'});ael.text(rtext);ael.on('click',build_evhan_hyperlink(win.id,rlink));el.append(ael);}
lineel.append(el);}}}}
if(win.type=='buffer'){let text=arg.text;if(win.inputel){win.inputel.detach();}
let cursel=$('#'+dom_prefix+'win'+win.id+'_cursor',dom_context);if(cursel.length)
cursel.remove();cursel=null;if(arg.clear){win.frameel.empty();win.topunseen=0;win.pagefrommark=0;}
if(text===undefined)
text=[];for(let ix=0;ix<text.length;ix++){const textarg=text[ix];const content=textarg.content;let divel=null;if(textarg.append){if(!content||!content.length)
continue;divel=buffer_last_line(win);}
if(divel==null){divel=$('<div>',{'class':'BufferLine BlankPara'});divel.data('blankpara',true);win.frameel.append(divel);}
if(textarg.flowbreak){divel.addClass('FlowBreak');}
if(!content||!content.length){if(divel.data('blankpara'))
divel.append($('<span>',{'class':'BlankLineSpan'}).text(' '));continue;}
if(divel.data('blankpara')){divel.data('blankpara',false);divel.removeClass('BlankPara');divel.empty();}
for(let sx=0;sx<content.length;sx++){const rdesc=content[sx];let rstyle,rtext,rlink;if(jQuery.type(rdesc)==='object'){if(rdesc.special!==undefined){if(rdesc.special=='image'){let imgurl=rdesc.url;if(Blorb&&Blorb.get_image_url){const newurl=Blorb.get_image_url(rdesc.image);if(newurl)
imgurl=newurl;}
let el=$('<img>',{src:imgurl});let winmaxwidth=rdesc.winmaxwidth;if(winmaxwidth===undefined)
winmaxwidth=1.0;if(winmaxwidth){el.css('max-width',percentstr(winmaxwidth));}
if(rdesc.widthratio===undefined){el.attr('width',''+rdesc.width);}
else{el.css('width',percentstr(rdesc.widthratio));}
if(rdesc.aspectwidth===undefined||rdesc.aspectheight===undefined){if(winmaxwidth&&rdesc.widthratio===undefined){el.css('aspect-ratio',ratiostr(rdesc.width,rdesc.height));}
else{el.attr('height',''+rdesc.height);}}
else{el.css('aspect-ratio',ratiostr(rdesc.aspectwidth,rdesc.aspectheight));}
if(rdesc.alttext)
el.attr('alt',rdesc.alttext);else
el.attr('alt','Image '+rdesc.image);switch(rdesc.alignment){case'inlineup':el.addClass('ImageInlineUp');break;case'inlinedown':el.addClass('ImageInlineDown');break;case'inlinecenter':el.addClass('ImageInlineCenter');break;case'marginleft':el.addClass('ImageMarginLeft');break;case'marginright':el.addClass('ImageMarginRight');break;default:el.addClass('ImageInlineUp');break;}
if(rdesc.hyperlink!=undefined){const ael=$('<a>',{'href':'#','class':'Internal'});ael.append(el);ael.on('click',build_evhan_hyperlink(win.id,rdesc.hyperlink));el=ael;}
divel.append(el);continue;}
glkote_log('Unknown special entry in line data: '+rdesc.special);continue;}
rstyle=rdesc.style;rtext=rdesc.text;rlink=rdesc.hyperlink;}
else{rstyle=rdesc;sx++;rtext=content[sx];rlink=undefined;}
const el=$('<span>',{'class':'Style_'+rstyle});if(rlink==undefined){insert_text_detecting(el,rtext);}
else{const ael=$('<a>',{'href':'#','class':'Internal'});ael.text(rtext);ael.on('click',build_evhan_hyperlink(win.id,rlink));el.append(ael);}
divel.append(el);}}
const parals=win.frameel.children();if(parals.length){const totrim=parals.length-max_buffer_length;if(totrim>0){const offtop=parals.get(totrim).offsetTop;win.topunseen-=offtop;if(win.topunseen<0)
win.topunseen=0;win.pagefrommark-=offtop;if(win.pagefrommark<0)
win.pagefrommark=0;for(let ix=0;ix<totrim;ix++){$(parals.get(ix)).remove();}}}
const divel=buffer_last_line(win);if(divel){const cursel=$('<span>',{id:dom_prefix+'win'+win.id+'_cursor','class':'InvisibleCursor'});const zwjel=$('<span>',{id:dom_prefix+'win'+win.id+'_curspos','class':'InvisiblePos'});zwjel.text(ZWJ);cursel.append(zwjel);divel.append(cursel);if(win.inputel){const inputel=win.inputel;const posleft=$('#'+dom_prefix+'win'+win.id+'_curspos',dom_context).offset().left-win.frameel.offset().left;const width=win.frameel.width()-(current_metrics.buffermarginx+posleft+2);if(width<inputel_minwidth){inputel.css({width:inputel_minwidth+'px',position:'',left:'',top:'',});}
else{inputel.css({width:width+'px',position:'absolute',left:'0px',top:'0px',});}
cursel.append(inputel);}}}
if(win.type=='graphics'){let draw=arg.draw;if(draw===undefined)
draw=[];const docall=(graphics_draw_queue.length==0);for(let ix=0;ix<draw.length;ix++){const op=draw[ix];const newop={winid:win.id};Object.assign(newop,op);graphics_draw_queue.push(newop);}
if(docall&&graphics_draw_queue.length>0){perform_graphics_ops(null);}}}
function accept_inputcancel(arg){const hasinput={};for(const argi of arg){if(argi.type)
hasinput[argi.id]=argi;}
for(const win of windowdic.values()){if(win.input){const argi=hasinput[win.id];if(argi==null||argi.gen>win.input.gen){win.input=null;win.frameel.addClass('HasNoInputField');win.frameel.removeClass('HasInputField');if(win.inputel){win.inputel.remove();win.inputel=null;}}}}}
function accept_inputset(arg){const hasinput={};const hashyperlink={};const hasmouse={};for(const argi of arg){if(argi.type)
hasinput[argi.id]=argi;if(argi.hyperlink)
hashyperlink[argi.id]=true;if(argi.mouse)
hasmouse[argi.id]=true;}
for(const win of windowdic.values()){win.reqhyperlink=hashyperlink[win.id];win.reqmouse=hasmouse[win.id];const argi=hasinput[win.id];if(argi==null)
continue;win.input=argi;win.frameel.addClass('HasInputField');win.frameel.removeClass('HasNoInputField');let maxlen=1;if(argi.type=='line')
maxlen=argi.maxlen;let newinputel=false;let inputel=win.inputel;if(inputel==null){newinputel=true;let classes='Input';if(argi.type=='line'){classes+=' LineInput';}
else if(argi.type=='char'){classes+=' CharInput';}
else{glkote_error('Window '+win.id+' has requested unrecognized input type '+argi.type+'.');}
inputel=$('<input>',{id:dom_prefix+'win'+win.id+'_input','class':classes,type:'text',maxlength:maxlen});if(is_mobile){if(maxlen<3)
inputel.attr('placeholder','\u2316');else
inputel.attr('placeholder',localize('glkote_taphere'));}
inputel.attr({'aria-live':'off','autocapitalize':'off',});if(argi.type=='line'){inputel.on('keypress',evhan_input_keypress);inputel.on('keydown',evhan_input_keydown);if(argi.initial)
inputel.val(argi.initial);win.terminators={};if(argi.terminators){for(let ix=0;ix<argi.terminators.length;ix++)
win.terminators[argi.terminators[ix]]=true;}}
else if(argi.type=='char'){inputel.on('keypress',evhan_input_char_keypress);inputel.on('keydown',evhan_input_char_keydown);inputel.on('input',evhan_input_char_input);}
inputel.on('focus',win.id,evhan_input_focus);inputel.data('winid',win.id);win.inputel=inputel;win.historypos=win.history.length;win.needscroll=true;}
if(win.type=='grid'){const lineel=$('#'+dom_prefix+'win'+win.id+'_ln'+argi.ypos,dom_context);if(!lineel.length){glkote_error('Window '+win.id+' has requested input at unknown line '+argi.ypos+'.');return;}
const pos=lineel.position();const xpos=pos.left+Math.round(argi.xpos*current_metrics.gridcharwidth);let width=Math.round(maxlen*current_metrics.gridcharwidth);const maxwidth=win.frameel.width()-(current_metrics.buffermarginx+xpos+2);if(width>maxwidth)
width=maxwidth;inputel.css({position:'absolute',left:xpos+'px',top:pos.top+'px',width:width+'px'});if(newinputel)
win.frameel.append(inputel);}
if(win.type=='buffer'){let cursel=$('#'+dom_prefix+'win'+win.id+'_cursor',dom_context);if(!cursel.length){cursel=$('<span>',{id:dom_prefix+'win'+win.id+'_cursor','class':'InvisibleCursor'});const zwjel=$('<span>',{id:dom_prefix+'win'+win.id+'_curspos','class':'InvisiblePos'});zwjel.text(ZWJ);cursel.append(zwjel);win.frameel.append(cursel);}
const posleft=$('#'+dom_prefix+'win'+win.id+'_curspos',dom_context).offset().left-win.frameel.offset().left;const width=win.frameel.width()-(current_metrics.buffermarginx+posleft+2);if(width<inputel_minwidth){inputel.css({width:inputel_minwidth+'px',position:'',left:'',top:'',});}
else{inputel.css({width:width+'px',position:'absolute',left:'0px',top:'0px',});}
if(newinputel)
cursel.append(inputel);}}}
function accept_timerrequest(arg){if(request_timer){window.clearTimeout(request_timer);request_timer=null;request_timer_interval=null;}
if(!arg){}
else{request_timer_interval=arg;request_timer=window.setTimeout(evhan_timer_event,request_timer_interval);}}
function accept_specialinput(arg){if(arg.type=='fileref_prompt'){let replyfunc=function(ref){send_response('specialresponse',null,'fileref_prompt',ref);};try{const writable=(arg.filemode!='read');Dialog.open(writable,arg.filetype,arg.gameid,replyfunc);}
catch(ex){GlkOte.log('Unable to open file dialog: '+ex);replyfunc=function(){send_response('specialresponse',null,'fileref_prompt',null);};defer_func(replyfunc);}}
else{glkote_error('Request for unknown special input type: '+arg.type);}}
function buffer_last_line(win){const divel=last_child_of(win.frameel);if(divel==null)
return null;if(divel.className.indexOf('BufferLine')<0)
return null;return $(divel);}
function buffer_last_line_top_offset(win){const divel=buffer_last_line(win);if(!divel||!divel.length)
return 0;return divel.get(0).offsetTop;}
function readjust_paging_focus(canfocus){windows_paging_count=0;let pageable_win=0;if(perform_paging){for(const win of windowdic.values()){if(win.needspaging){windows_paging_count+=1;if(!pageable_win||win.id==last_known_paging)
pageable_win=win.id;}}}
if(windows_paging_count){last_known_paging=pageable_win;}
if(!windows_paging_count&&canfocus){let newinputwin=0;if(!disabled&&!windows_paging_count){for(const win of windowdic.values()){if(win.input){if(!newinputwin||win.id==last_known_focus)
newinputwin=win.id;}}}
if(newinputwin){const win=windowdic.get(newinputwin);if(win.inputel){win.inputel.focus();}}}}
function glkote_get_interface(){return game_interface;}
function glkote_get_library(val){switch(val){case'Dialog':return Dialog;case'Blorb':return Blorb;}
return null;}
function glkote_get_dom_id(val){switch(val){case'windowport':return windowport_id;case'gameport':return gameport_id;case'errorpane':return errorpane_id;case'errorcontent':return errorcontent_id;case'loadingpane':return loadingpane_id;}
return val;}
function glkote_set_dom_context(val){dom_context=val;}
function glkote_get_dom_context(){return dom_context;}
function glkote_save_allstate(){const obj={metrics:{width:current_metrics.width,height:current_metrics.height},history:{}};for(const[winid,win]of windowdic.entries()){if(win.history&&win.history.length)
obj.history[winid]=win.history.slice(0);if(win.defcolor){if(obj.defcolor===undefined)
obj.defcolor={};obj.defcolor[winid]=win.defcolor;}}
if(recording&&recording_state){obj.recording_sessionid=recording_state.sessionId;}
return obj;}
function glkote_log(msg){if(window.__tqLogLine)
window.__tqLogLine('engine: '+msg);if(window.console&&console.log)
console.log(msg);else if(window.opera&&opera.postError)
opera.postError(msg);}
function glkote_error(msg){if(!msg)
msg='???';let el=document.getElementById(errorcontent_id);if(!el)return;remove_children(el);el.appendChild(document.createTextNode(msg));el=document.getElementById(errorpane_id);if(el.className=='WarningPane')
el.className=null;el.style.display='block';error_visible=true;hide_loading();if(window.__tqEngineError){try{window.__tqEngineError(msg);}catch(e){}}}
function glkote_warning(msg){if(error_visible)
return;if(!msg){$('#'+errorpane_id).hide();return;}
const el=document.getElementById(errorcontent_id);if(!el)return;remove_children(el);el.appendChild(document.createTextNode(msg));$('#'+errorpane_id).addClass('WarningPane');$('#'+errorpane_id).show();hide_loading();}
function glkote_extevent(val){send_response('external',null,val);}
function retry_update(){retry_timer=null;glkote_log('Retrying update...');send_response('refresh',null,null);}
function percentstr(num){let val=''+(num*100);if(val=='NaN'){console.log('bad value in percentstr',num);return'';}
let pos=val.indexOf('.');if(pos>=0)
val=val.slice(0,pos+4);return val+'%';}
function ratiostr(wid,hgt){if(!wid||!hgt){console.log('bad value in ratiostr',wid,hgt);return'';}
return''+wid+'/'+hgt;}
function hide_loading(){if(loading_visible==false)
return;loading_visible=false;const el=document.getElementById(loadingpane_id);if(el){el.style.display='none';}}
function show_loading(){if(loading_visible==true)
return;loading_visible=true;const el=document.getElementById(loadingpane_id);if(el){el.style.display='';}}
function remove_children(parent){const ls=parent.childNodes;while(ls.length>0){const obj=ls.item(0);parent.removeChild(obj);}}
function last_child_of(obj){const ls=obj.children();if(!ls||!ls.length)
return null;return ls.get(ls.length-1);}
function insert_text_detecting(el,val){if(!detect_external_links){el.append(document.createTextNode(val));return;}
if(detect_external_links=='match'){if(regex_external_links.test(val)){const ael=$('<a>',{'href':val,'class':'External','target':'_blank'});ael.text(val);el.append(ael);return;}}
else if(detect_external_links=='search'){while(true){const match=regex_external_links.exec(val);if(!match)
break;if(match.index>0){const prefix=val.substring(0,match.index);el.append(document.createTextNode(prefix));}
const ael=$('<a>',{'href':match[0],'class':'External','target':'_blank'});ael.text(match[0]);el.append(ael);val=val.substring(match.index+match[0].length);}
if(!val.length)
return;}
el.append(document.createTextNode(val));}
function canvas_get_2dcontext(canvasel){if(!canvasel||!canvasel.length)
return undefined;const canvas=canvasel.get(0);if(canvas&&canvas.getContext){return canvas.getContext('2d');}
return undefined;}
function perform_graphics_ops(loadedimg,loadedev){if(graphics_draw_queue.length==0){glkote_log('perform_graphics_ops called with no queued ops'+(loadedimg?' (plus image!)':''));return;}
while(graphics_draw_queue.length){const op=graphics_draw_queue[0];const win=windowdic.get(op.winid);if(!win){glkote_log('perform_graphics_ops: op for nonexistent window '+op.winid);graphics_draw_queue.shift();continue;}
const el=$('#'+dom_prefix+'win'+win.id+'_canvas',dom_context);const ctx=canvas_get_2dcontext(el);if(!ctx){glkote_log('perform_graphics_ops: op for nonexistent canvas '+win.id);graphics_draw_queue.shift();continue;}
const optype=op.special;switch(optype){case'setcolor':win.defcolor=op.color;break;case'fill':if(op.color===undefined)
ctx.fillStyle=win.defcolor;else
ctx.fillStyle=op.color;if(op.x===undefined){ctx.fillRect(0,0,win.graphwidth,win.graphheight);win.frameel.css('background-color',ctx.fillStyle);}
else{ctx.fillRect(op.x,op.y,op.width,op.height);}
ctx.fillStyle='#000000';break;case'image':const cachekey=(op.url||op.image);if(!loadedimg){const oldimg=image_cache[cachekey];if(oldimg&&oldimg.width>0&&oldimg.height>0){loadedimg=oldimg;loadedev=true;}
else{delete image_cache[cachekey];}}
if(!loadedimg){let imgurl=op.url;if(Blorb&&Blorb.get_image_url){const newurl=Blorb.get_image_url(op.image);if(newurl)
imgurl=newurl;}
const newimg=new Image();$(newimg).on('load',function(ev){perform_graphics_ops(newimg,ev);});$(newimg).on('error',function(){perform_graphics_ops(newimg,null);});newimg.src=imgurl;return;}
if(loadedev){image_cache[cachekey]=loadedimg;ctx.drawImage(loadedimg,op.x,op.y,op.width,op.height);}
loadedev=null;loadedimg=null;break;default:glkote_log('Unknown special entry in graphics content: '+optype);break;}
graphics_draw_queue.shift();}}
function delay_func(timeout,func)
{return window.setTimeout(func,timeout*1000);}
function defer_func(func)
{return window.setTimeout(func,0.01*1000);}
/* Ввод из строки команд и нативной панели. Тип запроса важен: если игра
   ждёт нажатие клавиши (char), ответ строкой (line) движок молча теряет,
   и ввод «залипает» до следующего хода. */
window.__tqSubmitFromNative=function(text){const val=String(text==null?'':text);let win=null;let cwin=null;
if(windowdic)for(const w of windowdic.values()){if(!w||!w.input)continue;if(w.input.type=='line'&&!win)
win=w;else if(w.input.type=='char'&&!cwin)
cwin=w;}
if(win)return submit_line_input(win,val,null)!==false;
if(cwin)return send_response('char',cwin,(val.length?val.charAt(0):'return'))!==false;
return false;};
/* Какой ввод ждёт игра: 'line', 'char' или ничего. */
window.__tqInputType=function(){if(!windowdic)return null;let res=null;
for(const w of windowdic.values()){if(!w||!w.input)continue;if(w.input.type=='char')return'char';if(w.input.type=='line')res='line';}
return res;};
function submit_line_input(win,val,termkey){let historylast=null;if(win.history.length)
historylast=win.history[win.history.length-1];if(val&&val!=historylast){win.history.push(val);if(win.history.length>20){win.history.shift();}}
return send_response('line',win,val,termkey);}
function send_response(type,win,val,val2){if(disabled&&type!='specialresponse')
return false;if(generation<=generation_sent&&!(type=='init'||type=='refresh')){glkote_log('Not sending repeated generation number: '+generation);if(window.__tqLogLine)
window.__tqLogLine('engine drop '+type+' gen='+generation);return false;}
let winid=0;if(win)
winid=win.id;const res={type:type,gen:generation};generation_sent=generation;if(type=='line'){res.window=win.id;res.value=val;if(val2)
res.terminator=val2;}
else if(type=='char'){res.window=win.id;res.value=val;}
else if(type=='hyperlink'){res.window=win.id;res.value=val;}
else if(type=='mouse'){res.window=win.id;res.x=val;res.y=val2;}
else if(type=='external'){res.value=val;}
else if(type=='specialresponse'){res.response=val;res.value=val2;}
else if(type=='debuginput'){res.value=val;}
else if(type=='redraw'){res.window=win.id;}
else if(type=='init'){res.metrics=val;res.support=['timer','graphics','graphicswin','graphicsext','hyperlinks'];}
else if(type=='arrange'){res.metrics=val;}
if(!(type=='init'||type=='refresh'||type=='specialresponse'||type=='debuginput')){for(const win of windowdic.values()){const savepartial=(type!='line'&&type!='char')||(win.id!=winid);if(savepartial&&win.input&&win.input.type=='line'&&win.inputel&&win.inputel.val()){let partial=res.partial;if(!partial){partial={};res.partial=partial;}
partial[win.id]=win.inputel.val();}}}
if(recording){recording_state.input=res;recording_state.timestamp=(new Date().getTime());}
game_interface.accept(res);return true;}
const localization_basemap={glkote_more:'More',glkote_taphere:'Tap here to type',};function localize(key){let val=localization_map[key];if(val)
return val;val=localization_basemap[key];if(val)
return val;return key;}
function get_query_params(){var map={};var qs=location.search.substring(1,location.search.length);if(qs.length){var args=qs.split('&');qs=qs.replace(/\+/g,' ');for(var ix=0;ix<args.length;ix++){var pair=args[ix].split('=');var name=decodeURIComponent(pair[0]);var value=(pair.length==2)?decodeURIComponent(pair[1]):name;map[name]=value;}}
return map;}
function recording_send(arg){recording_state.output=arg;recording_state.outtimestamp=(new Date().getTime());let send=true;if(recording_state.format=='simple'){const input=recording_state.input;const output=recording_state.output;let inputtype=null;if(input)
inputtype=input.type;if(inputtype=='line'||inputtype=='char'){recording_state.input=input.value;}
else if(inputtype=='init'||inputtype=='external'||inputtype=='specialresponse'||!inputtype){recording_state.input='';}
else{send=false;}
if(output.windows){recording_context.bufferwins={};for(let ix=0;ix<output.windows.length;ix++){if(output.windows[ix].type=='buffer')
recording_context.bufferwins[output.windows[ix].id]=true;}}
let buffer='';if(output.content){for(let ix=0;ix<output.content.length;ix++){const content=output.content[ix];if(recording_context.bufferwins&&recording_context.bufferwins[content.id]){if(content.text){for(let jx=0;jx<content.text.length;jx++){const text=content.text[jx];if(!text.append)
buffer=buffer+'\n';if(text.content){for(let kx=0;kx<text.content.length;kx++){const el=text.content[kx];if(jQuery.type(el)=='string'){kx++;buffer=buffer+text.content[kx];}
else{if(el.text)
buffer=buffer+el.text;}}}}}}}}
recording_state.output=buffer;}
if(send)
recording_handler(recording_state);recording_state.input=null;recording_state.output=null;recording_state.timestamp=0;recording_state.outtimestamp=0;}
function recording_standard_handler(state){jQuery.ajax(recording_handler_url,{type:'POST',contentType:'application/json',data:JSON.stringify(state),error:function(jqxhr,textstatus,errorthrown){glkote_log('Transcript recording failed; deactivating. Error '+textstatus+': '+errorthrown);recording=false;}});}
function glkote_force_arrange(){if(!is_inited||disabled||!game_interface)
return false;current_metrics=null;arrange_retries=0;doc_resize_real();return true;}
function evhan_doc_resize(){if(resize_timer!=null){window.clearTimeout(resize_timer);resize_timer=null;}
resize_timer=delay_func(0.20,doc_resize_real);}
function doc_resize_real(){resize_timer=null;if(disabled){resize_timer=delay_func(0.20,doc_resize_real);return;}
const new_metrics=measure_window();if(current_metrics&&metrics_match(new_metrics,current_metrics)){arrange_retries=0;return;}
/* На одно поколение — один ответ: если движок ещё не ответил на прошлый
   ход, arrange теряется, а окна игры остаются от размера с клавиатурой.
   Метрики нужны сразу: ответ движка приходит синхронно и считает по ним
   координаты окон. Если ответ не ушёл — откатываем метрики и повторяем. */
const prev_metrics=current_metrics;current_metrics=new_metrics;
if(send_response('arrange',null,new_metrics)){arrange_retries=0;}
else{current_metrics=prev_metrics;if(arrange_retries<12){arrange_retries++;resize_timer=delay_func(0.25,doc_resize_real);}
else{arrange_retries=0;}}}
function evhan_viewport_resize(){if((visualViewport.scale-1)>0.001){return;}
if(current_viewportheight==visualViewport.height){return;}
current_viewportheight=visualViewport.height;/* В APK клавиатура — оверлей поверх игры (adjustNothing): страницу и окна
   игры не двигаем, иначе игра «уезжает» вверх и теряет размер. */
if(window.AndroidBridge){return;}
if(($(window).height()-current_viewportheight)<40){return;}
const gameport=$('#'+gameport_id,dom_context);const oldheight=gameport.outerHeight();let newtop=($(window).height()-current_viewportheight);if(newtop<orig_gameport_margins.top)
newtop=orig_gameport_margins.top;const newreltop=newtop-orig_gameport_margins.parenttop;const newheight=$(window).height()-(newtop+orig_gameport_margins.bottom);if(oldheight-newheight>=-1&&oldheight-newheight<=1){return;}
gameport.css('top',newreltop+'px');gameport.outerHeight(newheight);window.scrollTo(0,newtop);defer_func(function(){window.scrollTo(0,newtop);});}
function send_window_redraw(winid){const win=windowdic.get(winid);if(!win||win.type!='graphics')
return;send_response('redraw',win,null);}
function evhan_doc_pixelreschange(){const ratio=window.devicePixelRatio||1;if(ratio!=current_devpixelratio){current_devpixelratio=ratio;for(const[winid,win]of windowdic.entries()){if(win.type=='graphics'){const el=$('#'+dom_prefix+'win'+win.id+'_canvas',dom_context);win.scaleratio=current_devpixelratio/win.backpixelratio;const ctx=canvas_get_2dcontext(el);el.attr('width',win.graphwidth*win.scaleratio);el.attr('height',win.graphheight*win.scaleratio);el.css('width',(win.graphwidth+'px'));el.css('height',(win.graphheight+'px'));if(ctx){ctx.setTransform(win.scaleratio,0,0,win.scaleratio,0,0);ctx.fillStyle=win.defcolor;ctx.fillRect(0,0,win.graphwidth,win.graphheight);ctx.fillStyle='#000000';}
win.frameel.css('background-color',win.defcolor);defer_func(function(){send_window_redraw(winid);});}}}}
function evhan_doc_keypress(ev){if(disabled){return;}
let keycode=0;if(ev)keycode=ev.which;if(ev.target.tagName.toUpperCase()=='INPUT'){return;}
if(ev.target.className.indexOf('CanHaveInputFocus')>=0){return;}
if(ev.altKey||ev.metaKey||ev.ctrlKey){return;}
if(windows_paging_count){const win=windowdic.get(last_known_paging);if(win){ev.preventDefault();const frameel=win.frameel;frameel.scrollTop(win.topunseen-current_metrics.buffercharheight);const frameheight=frameel.outerHeight();win.scrolledtoend=frameel.scrollTop()+frameheight+moreprompt_margin>=frameel.get(0).scrollHeight;const realbottom=buffer_last_line_top_offset(win);let newtopunseen=frameel.scrollTop()+frameheight;if(newtopunseen>realbottom)
newtopunseen=realbottom;if(win.topunseen<newtopunseen)
win.topunseen=newtopunseen;if(win.needspaging){if(win.scrolledtoend){win.needspaging=false;const moreel=$('#'+dom_prefix+'win'+win.id+'_moreprompt',dom_context);if(moreel.length)
moreel.remove();readjust_paging_focus(true);}}
return;}}
const win=windowdic.get(last_known_focus);if(!win)
return;if(!win.inputel)
return;win.inputel.focus();if(win.input.type=='line'){if(keycode==13){submit_line_input(win,win.inputel.val(),null);ev.preventDefault();return;}
if(keycode){if(keycode>=32){const val=String.fromCharCode(keycode);win.inputel.val(win.inputel.val()+val);}
ev.preventDefault();return;}}
else{let res=null;if(keycode==13)
res='return';else if(keycode==key_codes.KEY_BACKSPACE)
res='delete';else if(keycode)
res=String.fromCharCode(keycode);if(res){send_response('char',win,res);}
ev.preventDefault();return;}}
function evhan_window_mousedown(ev){const winid=ev.data;const win=windowdic.get(winid);if(!win)
return;if(win.inputel){last_known_focus=win.id;}
if(win.needspaging)
last_known_paging=win.id;else if(win.inputel)
last_known_paging=0;}
function evhan_input_mouse_click(ev){const winid=ev.data;const win=windowdic.get(winid);if(!win)
return;if(ev.button!=0)
return;if(!win.reqmouse)
return;let xpos=0;let ypos=0;if(win.type=='grid'){const lineel=$('#'+dom_prefix+'win'+win.id+'_ln'+0,dom_context);if(lineel.length){const linepos=lineel.offset();xpos=Math.floor((ev.clientX-linepos.left)/current_metrics.gridcharwidth);ypos=Math.floor((ev.clientY-linepos.top)/current_metrics.gridcharheight);}
if(xpos>=win.gridwidth)
xpos=win.gridwidth-1;if(xpos<0)
xpos=0;if(ypos>=win.gridheight)
ypos=win.gridheight-1;if(ypos<0)
ypos=0;}
else if(win.type=='graphics'){const canel=$('#'+dom_prefix+'win'+win.id+'_canvas',dom_context);if(canel.length){const pos=canel.offset();xpos=ev.clientX-pos.left;ypos=ev.clientY-pos.top;}
if(xpos>=win.graphwidth)
xpos=win.graphwidth-1;if(xpos<0)
xpos=0;if(ypos>=win.graphheight)
ypos=win.graphheight-1;if(ypos<0)
ypos=0;}
else{return;}
ev.preventDefault();send_response('mouse',win,xpos,ypos);}
function evhan_input_char_keydown(ev){let keycode=0;if(ev)keycode=ev.keyCode;if(!keycode)return true;let res=null;switch(keycode){case key_codes.KEY_LEFT:res='left';break;case key_codes.KEY_RIGHT:res='right';break;case key_codes.KEY_UP:res='up';break;case key_codes.KEY_DOWN:res='down';break;case key_codes.KEY_BACKSPACE:res='delete';break;case key_codes.KEY_ESC:res='escape';break;case key_codes.KEY_TAB:res='tab';break;case key_codes.KEY_PAGEUP:res='pageup';break;case key_codes.KEY_PAGEDOWN:res='pagedown';break;case key_codes.KEY_HOME:res='home';break;case key_codes.KEY_END:res='end';break;case 112:res='func1';break;case 113:res='func2';break;case 114:res='func3';break;case 115:res='func4';break;case 116:res='func5';break;case 117:res='func6';break;case 118:res='func7';break;case 119:res='func8';break;case 120:res='func9';break;case 121:res='func10';break;case 122:res='func11';break;case 123:res='func12';break;}
if(res){const winid=$(this).data('winid');const win=windowdic.get(winid);if(!win||!win.input)
return true;send_response('char',win,res);return false;}
return true;}
function evhan_input_char_keypress(ev){let keycode=0;if(ev)keycode=ev.which;if(!keycode)return false;let res;if(keycode==13)
res='return';else
res=String.fromCharCode(keycode);const winid=$(this).data('winid');const win=windowdic.get(winid);if(!win||!win.input)
return true;send_response('char',win,res);return false;}
function evhan_input_char_input(ev){const char=ev.target.value[0]
if(char===''||char==null){return false;}
var winid=$(this).data('winid');var win=windowdic.get(winid);if(!win||!win.input){return true;}
ev.target.value=''
send_response('char',win,char);if(char===' '){$(ev.target).trigger('blur').trigger('focus')}
return false;}
function evhan_input_keydown(ev){let keycode=0;if(ev)keycode=ev.keyCode;if(!keycode)return true;if(keycode==key_codes.KEY_UP||keycode==key_codes.KEY_DOWN){const winid=$(this).data('winid');const win=windowdic.get(winid);if(!win||!win.input)
return true;if(keycode==key_codes.KEY_UP&&win.historypos>0){win.historypos-=1;if(win.historypos<win.history.length)
this.value=win.history[win.historypos];else
this.value='';}
if(keycode==key_codes.KEY_DOWN&&win.historypos<win.history.length){win.historypos+=1;if(win.historypos<win.history.length)
this.value=win.history[win.historypos];else
this.value='';}
return false;}
else if(keycode==key_codes.KEY_PAGEDOWN||keycode==key_codes.KEY_PAGEUP||keycode==key_codes.KEY_HOME||keycode==key_codes.KEY_END){const winid=$(this).data('winid');const win=windowdic.get(winid);if(win){const frameel=win.frameel;const frameheight=frameel.outerHeight();let newval=0;if(keycode==key_codes.KEY_PAGEDOWN){newval=frameel.scrollTop()+(frameheight-current_metrics.buffercharheight);}
else if(keycode==key_codes.KEY_PAGEUP){newval=frameel.scrollTop()-(frameheight-current_metrics.buffercharheight);}
else if(keycode==key_codes.KEY_HOME){newval=0;}
else{newval=frameel.get(0).scrollHeight;}
frameel.scrollTop(newval);return false;}}
else if(terminator_key_values[keycode]){const winid=$(this).data('winid');const win=windowdic.get(winid);if(!win||!win.input)
return true;if(win.terminators[terminator_key_values[keycode]]){submit_line_input(win,win.inputel.val(),terminator_key_values[keycode]);return false;}}
return true;}
function evhan_input_keypress(ev){let keycode=0;if(ev)keycode=ev.which;if(!keycode)return true;if(keycode==13){const winid=$(this).data('winid');const win=windowdic.get(winid);if(!win||!win.input)
return true;submit_line_input(win,this.value,null);return false;}
return true;}
function evhan_input_focus(ev){const winid=ev.data;const win=windowdic.get(winid);if(!win)
return;last_known_focus=winid;last_known_paging=winid;}
function evhan_window_scroll(ev){const winid=ev.data;const win=windowdic.get(winid);if(!win)
return;const frameel=win.frameel;const frameheight=frameel.outerHeight();win.scrolledtoend=frameel.scrollTop()+frameheight+moreprompt_margin>=frameel.get(0).scrollHeight;if(!win.needspaging)
return;const realbottom=buffer_last_line_top_offset(win);let newtopunseen=frameel.scrollTop()+frameheight;if(newtopunseen>realbottom)
newtopunseen=realbottom;if(win.topunseen<newtopunseen)
win.topunseen=newtopunseen;if(win.scrolledtoend){win.needspaging=false;const moreel=$('#'+dom_prefix+'win'+win.id+'_moreprompt',dom_context);if(moreel.length)
moreel.remove();readjust_paging_focus(true);return;}}
function window_scroll_to_bottom(win){const frameel=win.frameel;const frameheight=frameel.outerHeight();frameel.scrollTop(frameel.get(0).scrollHeight-frameheight);win.scrolledtoend=true;const realbottom=buffer_last_line_top_offset(win);let newtopunseen=frameel.scrollTop()+frameheight;if(newtopunseen>realbottom)
newtopunseen=realbottom;if(win.topunseen<newtopunseen)
win.topunseen=newtopunseen;if(win.needspaging){if(frameel.scrollTop()+frameheight+moreprompt_margin>=frameel.get(0).scrollHeight){win.needspaging=false;const moreel=$('#'+dom_prefix+'win'+win.id+'_moreprompt',dom_context);if(moreel.length)
moreel.remove();readjust_paging_focus(true);}}}
function build_evhan_hyperlink(winid,linkval){return function(){const win=windowdic.get(winid);if(!win)
return false;if(!win.reqhyperlink)
return false;send_response('hyperlink',win,linkval);return false;};}
function evhan_timer_event(){if((!request_timer)||(!request_timer_interval)){return;}
request_timer=window.setTimeout(evhan_timer_event,request_timer_interval);if(disabled){return;}
send_response('timer');}
function evhan_debug_command(cmd){send_response('debuginput',null,cmd);}
var api={classname:'GlkOte',version:'2.3.7',init:glkote_init,inited:glkote_inited,forcerearrange:glkote_force_arrange,update:glkote_update,extevent:glkote_extevent,getinterface:glkote_get_interface,getlibrary:glkote_get_library,getdomid:glkote_get_dom_id,getdomcontext:glkote_get_dom_context,setdomcontext:glkote_set_dom_context,save_allstate:glkote_save_allstate,log:glkote_log,warning:glkote_warning,error:glkote_error};window.__tqGlkOte=api;return api;};var GlkOte=new GlkOteClass();try{exports.GlkOte=GlkOte;exports.GlkOteClass=GlkOteClass;}catch(ex){};'use strict';var DialogClass=function(){var GlkOte=null;var dialog_el_id='dialog';let localization_map={};var is_open=false;var dialog_callback=null;var will_save;var confirming;var editing;var editing_dirent;var cur_usage;var cur_usage_name;var cur_usage_names;var cur_gameid;var cur_filelist;function dialog_init(iface){if(iface&&iface.dom_prefix){dialog_el_id=iface.dom_prefix;}
if(iface&&iface.localize){localization_map=iface.localize;}
if(iface&&iface.GlkOte){GlkOte=iface.GlkOte;}
if(!GlkOte){GlkOte=window.GlkOte;}
if(!GlkOte){throw new Error('Dialog: no GlkOte interface!');}}
function dialog_inited(){return(GlkOte!=null);}
function dialog_get_library(val){switch(val){case'GlkOte':return GlkOte;}
return null;}
function dialog_open(tosave,usage,gameid,callback){if(is_open)
throw new Error('Dialog: dialog box is already open.');if(!Storage)
throw new Error('Dialog: no storage API is available.');dialog_callback=callback;will_save=tosave;confirming=false;editing=false;editing_dirent=null;cur_usage=usage;cur_gameid=gameid;cur_usage_name=label_for_usage(cur_usage);cur_usage_names=label_for_usage(cur_usage,true);var root_el_id='windowport';if(window.GlkOte)
root_el_id=GlkOte.getdomid('windowport');var rootel=$('#'+root_el_id);if(!rootel.length)
throw new Error('Dialog: unable to find root element #'+root_el_id+'.');var screen=$('#'+dialog_el_id+'_screen');if(!screen.length){screen=$('<div>',{id:dialog_el_id+'_screen',class:'DialogScreen'});rootel.append(screen);}
var frame=$('#'+dialog_el_id+'_frame');if(!frame.length){frame=$('<div>',{id:dialog_el_id+'_frame',class:'DialogFrame'});rootel.append(frame);}
var dia=$('#'+dialog_el_id);if(dia.length)
dia.remove();dia=$('<div>',{id:dialog_el_id,class:'Dialog'});var form,el,row;form=$('<form>');form.on('submit',(will_save?evhan_accept_save_button:evhan_accept_load_button));dia.append(form);row=$('<div>',{'class':'DiaButtonsFloat'});el=$('<button>',{id:dialog_el_id+'_edit',type:'button'});el.text(localize('dialog_edit'));el.on('click',evhan_edit_button);row.append(el);form.append(row);row=$('<div>',{id:dialog_el_id+'_cap','class':'DiaCaption'});row.text('XXX');form.append(row);if(will_save){row=$('<div>',{id:dialog_el_id+'_input','class':'DiaInput'});form.append(row);el=$('<input>',{id:dialog_el_id+'_infield',type:'text',name:'filename'});row.append(el);row=$('<div>',{id:dialog_el_id+'_warning','class':'DiaWarning'});row.text(localize('dialog_cookiewarning'));form.append(row);}
row=$('<div>',{id:dialog_el_id+'_body','class':'DiaBody'});form.append(row);row=$('<div>',{id:dialog_el_id+'_cap2','class':'DiaCaption'});row.hide();form.append(row);row=$('<div>',{id:dialog_el_id+'_buttonrow','class':'DiaButtons'});{el=$('<button>',{id:dialog_el_id+'_cancel',type:'button'});el.text(localize('dialog_cancel'));el.on('click',evhan_cancel_button);row.append(el);el=$('<button>',{id:dialog_el_id+'_delete',type:'button'});el.text(localize('dialog_delete'));el.on('click',evhan_delete_button);el.hide();row.append(el);el=$('<button>',{id:dialog_el_id+'_display',type:'button'});el.text(localize('dialog_display'));el.on('click',evhan_display_button);el.hide();row.append(el);el=$('<button>',{id:dialog_el_id+'_accept',type:'submit'});el.text(will_save?localize('dialog_save'):localize('dialog_load'));el.on('click',(will_save?evhan_accept_save_button:evhan_accept_load_button));row.append(el);}
form.append(row);frame.append(dia);is_open=true;evhan_storage_changed();var focusfunc;if(will_save){focusfunc=function(){var el=$('#'+dialog_el_id+'_infield');if(el.length)
el.focus();};}
else{focusfunc=function(){var el=$('#'+dialog_el_id+'_select');if(el.length)
el.focus();};}
defer_func(focusfunc);}
function dialog_close(){var dia=$('#'+dialog_el_id);if(dia.length)
dia.remove();var frame=$('#'+dialog_el_id+'_frame');if(frame.length)
frame.remove();var screen=$('#'+dialog_el_id+'_screen');if(screen.length)
screen.remove();is_open=false;dialog_callback=null;cur_filelist=null;editing=false;editing_dirent=null;}
function set_caption(msg,isupper){var elid=(isupper?dialog_el_id+'_cap':dialog_el_id+'_cap2');var el=$('#'+elid);if(!el.length)
return;if(!msg){el.hide();}
else{el.text(msg);el.show();}}
function label_for_usage(val,plural){if(!plural)
return localize('dialog_usage_'+val);else
return localize('dialog_usagepl_'+val);}
function usage_is_textual(val){return(val=='transcript'||val=='command');}
function defer_func(func)
{return window.setTimeout(func,0.01*1000);}
function evhan_select_change(){if(!is_open)
return false;if(confirming)
return false;var selel=$('#'+dialog_el_id+'_select');if(!selel.length)
return false;var pos=selel.prop('selectedIndex');if(!cur_filelist||pos<0||pos>=cur_filelist.length)
return false;var file=cur_filelist[pos];var fel=$('#'+dialog_el_id+'_infield');if(!fel.length)
return false;fel.val(file.dirent.filename);return false;}
function evhan_select_change_editing(){if(!is_open)
return false;if(!editing||editing_dirent)
return false;var butel=$('#'+dialog_el_id+'_delete');butel.prop('disabled',true);butel=$('#'+dialog_el_id+'_display');butel.prop('disabled',true);var selel=$('#'+dialog_el_id+'_select');if(!selel.length)
return false;var pos=selel.prop('selectedIndex');if(!cur_filelist||pos<0||pos>=cur_filelist.length)
return false;var file=cur_filelist[pos];if(!file||!file.dirent||!file_ref_exists(file.dirent))
return false;butel=$('#'+dialog_el_id+'_delete');butel.prop('disabled',false);butel=$('#'+dialog_el_id+'_display');butel.prop('disabled',false);}
function evhan_accept_load_button(ev){ev.preventDefault();if(!is_open)
return false;if(editing)
return false;var selel=$('#'+dialog_el_id+'_select');if(!selel.length)
return false;var pos=selel.prop('selectedIndex');if(!cur_filelist||pos<0||pos>=cur_filelist.length)
return false;var file=cur_filelist[pos];if(!file||!file.dirent||!file_ref_exists(file.dirent))
return false;var callback=dialog_callback;dialog_close();if(callback)
callback(file.dirent);return false;}
function evhan_accept_save_button(ev){ev.preventDefault();if(!is_open)
return false;if(editing)
return false;var fel=$('#'+dialog_el_id+'_infield');if(!fel.length)
return false;var filename=fel.val();filename=jQuery.trim(filename);if(!filename.length)
return false;var dirent=file_construct_ref(filename,cur_usage,cur_gameid);if(file_ref_exists(dirent)&&!confirming){confirming=true;let val=localize('dialog_confirmreplace');set_caption(val.replace('%1',cur_usage_name).replace('%2',dirent.filename),false);fel.prop('disabled',true);var butel=$('#'+dialog_el_id+'_accept');butel.text(localize('dialog_replace'));return false;}
var callback=dialog_callback;dialog_close();if(callback)
callback(dirent);return false;}
function evhan_edit_button(ev){ev.preventDefault();if(!is_open)
return false;if(!editing){editing=true;editing_dirent=null;if(confirming){confirming=false;set_caption(null,false);var fel=$('#'+dialog_el_id+'_infield');fel.prop('disabled',false);var butel=$('#'+dialog_el_id+'_accept');butel.prop('disabled',false);butel.text(localize('dialog_save'));}
var fel=$('#'+dialog_el_id+'_input');if(fel.length){fel.hide();}
var butel=$('#'+dialog_el_id+'_edit');butel.text(localize('dialog_done'));butel=$('#'+dialog_el_id+'_delete');butel.show();butel=$('#'+dialog_el_id+'_display');butel.show();butel=$('#'+dialog_el_id+'_accept');butel.hide();evhan_storage_changed();return false;}
else if(!editing_dirent){editing=false;editing_dirent=null;var fel=$('#'+dialog_el_id+'_input');if(fel.length){fel.show();}
var butel=$('#'+dialog_el_id+'_edit');butel.text(localize('dialog_edit'));butel=$('#'+dialog_el_id+'_delete');butel.hide();butel=$('#'+dialog_el_id+'_display');butel.hide();butel=$('#'+dialog_el_id+'_accept');butel.show();evhan_storage_changed();return false;}
else{editing=true;editing_dirent=null;$('#'+dialog_el_id+'_buttonrow').show();var butel=$('#'+dialog_el_id+'_edit');butel.text(localize('dialog_done'));evhan_storage_changed();return false;}}
function evhan_delete_button(ev){ev.preventDefault();if(!is_open)
return false;if(!editing||editing_dirent)
return false;var selel=$('#'+dialog_el_id+'_select');if(!selel.length)
return false;var pos=selel.prop('selectedIndex');if(!cur_filelist||pos<0||pos>=cur_filelist.length)
return false;var file=cur_filelist[pos];if(!file||!file.dirent)
return false;file_remove_ref(file.dirent);evhan_storage_changed();return false;}
function evhan_display_button(ev){ev.preventDefault();if(!is_open)
return false;if(!editing||editing_dirent)
return false;var selel=$('#'+dialog_el_id+'_select');if(!selel.length)
return false;var pos=selel.prop('selectedIndex');if(!cur_filelist||pos<0||pos>=cur_filelist.length)
return false;var file=cur_filelist[pos];if(!file||!file.dirent||!file_ref_exists(file.dirent))
return false;$('#'+dialog_el_id+'_buttonrow').hide();var butel=$('#'+dialog_el_id+'_edit');butel.text(localize('dialog_close'));editing_dirent=file.dirent;evhan_storage_changed();return false;}
function evhan_cancel_button(ev){ev.preventDefault();if(!is_open)
return false;if(confirming){confirming=false;set_caption(null,false);var fel=$('#'+dialog_el_id+'_infield');fel.prop('disabled',false);var butel=$('#'+dialog_el_id+'_accept');butel.prop('disabled',false);butel.text(localize('dialog_save'));return false;}
var callback=dialog_callback;dialog_close();if(callback)
callback(null);return false;}
function evhan_storage_changed(ev){if(!is_open)
return false;var el,bodyel,butel,ls,lastusage;var changedkey=null;if(ev)
changedkey=ev.key;bodyel=$('#'+dialog_el_id+'_body');if(!bodyel.length)
return false;if(editing&&editing_dirent){if(!file_ref_exists(editing_dirent)){editing_dirent=null;$('#'+dialog_el_id+'_buttonrow').show();butel=$('#'+dialog_el_id+'_edit');butel.text(localize('dialog_done'));}}
if(editing&&editing_dirent){bodyel.empty();var dat=file_read(editing_dirent);dat=String.fromCharCode.apply(this,dat);if(usage_is_textual(editing_dirent.usage)){var textel=$('<pre>',{'class':'DiaDisplayText'});textel.text(dat);bodyel.append(textel);set_caption(localize('dialog_displayingcontents'),true);}
else{var b64dat=window.btoa(dat);var linkel=$('<a>',{'href':'data:application/octet-stream;base64,'+b64dat,'target':'_blank','download':'data'});linkel.text(editing_dirent.filename);bodyel.append(linkel);set_caption(localize('dialog_usesaveas'),true);}
return false;}
if(editing){ls=files_list(null,cur_gameid);if(cur_gameid!=''){ls=ls.concat(files_list(null,''));}
ls.sort(function(f1,f2){if(f1.dirent.usage<f2.dirent.usage)
return-1;else if(f1.dirent.usage>f2.dirent.usage)
return 1;return f2.modified.getTime()-f1.modified.getTime();});if(ls.length==0){bodyel.empty();butel=$('#'+dialog_el_id+'_delete');butel.prop('disabled',true);butel=$('#'+dialog_el_id+'_display');butel.prop('disabled',true);set_caption(localize('dialog_nostoredfiles'),true);return false;}
var ix,file;cur_filelist=[];lastusage='';for(ix=0;ix<ls.length;ix++){file=ls[ix];if(file.dirent.usage!=lastusage){lastusage=file.dirent.usage;cur_filelist.push({label:lastusage});}
cur_filelist.push(file);}
ls=cur_filelist;bodyel.empty();var selel=$('<select>',{id:dialog_el_id+'_select',name:'files'});selel.prop('size','5');var datestr;var anyselected=false;for(ix=0;ix<ls.length;ix++){file=ls[ix];if(!file.dirent){el=$('<option>',{name:'f'+ix});el.prop('disabled',true);el.text('-- '+label_for_usage(file.label,true)+' --');selel.append(el);continue;}
el=$('<option>',{name:'f'+ix});if(!anyselected){anyselected=true;el.selected=true;}
datestr=format_date(file.modified);el.text(file.dirent.filename+' -- '+datestr);selel.append(el);}
bodyel.append(selel);selel.on('change',evhan_select_change_editing);evhan_select_change_editing();set_caption(localize('dialog_allvisible'),true);return false;}
ls=files_list(cur_usage,cur_gameid);ls.sort(function(f1,f2){return f2.modified.getTime()-f1.modified.getTime();});cur_filelist=ls;if(ls.length==0){bodyel.empty();}
else{bodyel.empty();var selel=$('<select>',{id:dialog_el_id+'_select',name:'files'});selel.prop('size','5');var ix,file,datestr;for(ix=0;ix<ls.length;ix++){file=ls[ix];el=$('<option>',{name:'f'+ix});if(ix==0)
el.selected=true;datestr=format_date(file.modified);el.text(file.dirent.filename+' -- '+datestr);selel.append(el);}
bodyel.append(selel);if(will_save)
selel.on('change',evhan_select_change);}
if(will_save){let val=localize('dialog_namethis');set_caption(val.replace('%1',cur_usage_name),true);el=$('#'+dialog_el_id+'_accept');el.prop('disabled',false);}
else{if(ls.length==0){set_caption(localize('dialog_nousagefiles').replace('%1',cur_usage_names),true);el=$('#'+dialog_el_id+'_accept');el.prop('disabled',true);}
else{set_caption(localize('dialog_selectafile').replace('%1',cur_usage_name),true);el=$('#'+dialog_el_id+'_accept');el.prop('disabled',false);}}}
function file_clean_fixed_name(filename,usage){return filename;}
function file_construct_ref(filename,usage,gameid){if(!filename)
filename='';if(!usage)
usage='';if(!gameid)
gameid='';var key=usage+':'+gameid+':'+filename;var ref={dirent:'dirent:'+key,content:'content:'+key,filename:filename,usage:usage,gameid:gameid};return ref;}
function file_construct_temp_ref(usage){var timestamp=new Date().getTime();var filename="_temp_"+timestamp+"_"+Math.random();filename=filename.replace('.','');return file_construct_ref(filename,usage);}
function file_decode_ref(dirkey){if(dirkey.slice(0,7)!='dirent:')
return null;var oldpos=7;var pos=dirkey.indexOf(':',oldpos);if(pos<0)
return null;var usage=dirkey.slice(oldpos,pos);oldpos=pos+1;pos=dirkey.indexOf(':',oldpos);if(pos<0)
return null;var gameid=dirkey.slice(oldpos,pos);oldpos=pos+1;var filename=dirkey.slice(oldpos);var conkey='cont'+dirkey.slice(3);var ref={dirent:dirkey,content:conkey,filename:filename,usage:usage,gameid:gameid};return ref;}
function file_load_dirent(dirent){if(typeof(dirent)!='object'){dirent=file_decode_ref(dirent);if(!dirent)
return null;}
var statstring=Storage.getItem(dirent.dirent);if(!statstring)
return null;var file={dirent:dirent};var ix,pos,key,val;var ls=statstring.toString().split(',');for(ix=0;ix<ls.length;ix++){val=ls[ix];pos=val.indexOf(':');if(pos<0)
continue;key=val.slice(0,pos);val=val.slice(pos+1);switch(key){case'created':file.created=new Date(Number(val));break;case'modified':file.modified=new Date(Number(val));break;}}
return file;}
function file_ref_exists(ref){var statstring=Storage.getItem(ref.dirent);if(!statstring)
return false;else
return true;}
function file_remove_ref(ref){Storage.removeItem(ref.dirent);Storage.removeItem(ref.content);}
function file_write(dirent,content,israw){var val,ls;var err1,err2;var file=file_load_dirent(dirent);if(!file){file={dirent:dirent,created:new Date()};}
file.modified=new Date();if(!israw)
content=JSON.stringify(content);ls=[];if(file.created)
ls.push('created:'+file.created.getTime());if(file.modified)
ls.push('modified:'+file.modified.getTime());val=ls.join(',');err1=Storage.setItem(file.dirent.dirent,val);err2=Storage.setItem(file.dirent.content,content);if(err1||err2)
return false;return true;}
function file_read(dirent,israw){var file=file_load_dirent(dirent);if(!file)
return null;var content=Storage.getItem(dirent.content);if(content==null)
return null;content=content.toString();if(content.slice(0,6)==='QPB64:'){var bin=atob(content.slice(6));var arr=new Array(bin.length);for(var qi=0;qi<bin.length;qi++)arr[qi]=bin.charCodeAt(qi);if(israw)
return bin;return arr;}if(!content){if(israw)
return'';else
return[];}
if(israw)
return content;else
return JSON.parse(content);}
function file_notimplemented(){throw new Error('streaming function not implemented in Dialog');}
function file_ref_matches(ref,usage,gameid){if(usage!=null){if(ref.usage!=usage)
return false;}
if(gameid!=null){if(ref.gameid!=gameid)
return false;}
return true;}
function files_list(usage,gameid){var ix;var ls=[];if(!Storage)
return ls;var keyls=Storage.getKeys();for(ix=0;ix<keyls.length;ix++){var key=keyls[ix];if(!key)
continue;var dirent=file_decode_ref(key.toString());if(!dirent)
continue;if(!file_ref_matches(dirent,usage,gameid))
continue;var file=file_load_dirent(dirent);ls.push(file);}
return ls;}
const localization_basemap={dialog_cancel:'Cancel',dialog_close:'Close',dialog_done:'Done',dialog_edit:'Edit',dialog_delete:'Delete',dialog_display:'Display',dialog_load:'Load',dialog_replace:'Replace',dialog_save:'Save',dialog_namethis:'Name this %1.',dialog_confirmreplace:'You already have a %1 "%2". Do you want to replace it?',dialog_cookiewarning:'Warning: data may be erased by clearing cookies or browser privacy policies.',dialog_allvisible:'All stored files are now visible. You may delete them, and display files containing text. Press Done when finished.',dialog_displayingcontents:'Displaying file contents...',dialog_usesaveas:'Use "Save As" option in your browser to download this link.',dialog_nostoredfiles:'You have no stored files. Press Done to continue.',dialog_nousagefiles:'You have no %1 for this game.',dialog_selectafile:'Select a %1 to load.',dialog_usage_data:'data file',dialog_usage_save:'save file',dialog_usage_transcript:'transcript',dialog_usage_command:'command script',dialog_usage_default:'file',dialog_usagepl_data:'data files',dialog_usagepl_save:'save files',dialog_usagepl_transcript:'transcripts',dialog_usagepl_command:'command scripts',dialog_usagepl_default:'files',};function localize(key){let val=localization_map[key];if(val)
return val;val=localization_basemap[key];if(val)
return val;return key;}
function format_date(date){if(!date)
return'???';var day=(date.getMonth()+1)+'/'+date.getDate();var time=date.getHours()+':'+(date.getMinutes()<10?'0':'')+date.getMinutes();return day+' '+time;}
function autosave_write(signature,snapshot){var key='autosave:'+signature;if(!snapshot){Storage.removeItem(key);}
else{Storage.setItem(key,JSON.stringify(snapshot));}}
function autosave_read(signature){var key='autosave:'+signature;var val=Storage.getItem(key);if(val){try{return JSON.parse(val);}
catch(ex){}}
return null;}
var Storage=null;try{var htmlLocalStorage=null;if(window.localStorage!=null){htmlLocalStorage=window.localStorage;}
else if(window.globalStorage!=null){htmlLocalStorage=window.globalStorage[location.hostname];}
if(htmlLocalStorage){try{htmlLocalStorage.setItem('_dialogtest','xyzzy');if(htmlLocalStorage.getItem('_dialogtest')!='xyzzy')
throw new Error('localStorage test did not match');htmlLocalStorage.removeItem('_dialogtest');Storage={getItem:function(key){try{return htmlLocalStorage.getItem(key);}
catch(ex){return null;}},removeItem:function(key){try{htmlLocalStorage.removeItem(key);}
catch(ex){}},setItem:function(key,val){try{htmlLocalStorage.setItem(key,val);}
catch(ex){GlkOte.log('Dialog: localStorage failed! '+ex);return true;}},getKeys:function(){var ls=[];for(var ix=0;ix<htmlLocalStorage.length;ix++)
ls.push(htmlLocalStorage.key(ix));return ls;}};}
catch(ex){GlkOte.log('Dialog: localStorage not available: '+ex);GlkOte.log('Dialog: falling back to window memory');}}}
catch(ex){}
if(Storage==null){Storage={data:{},keys:[],getItem:function(key){return Storage.data[key];},setItem:function(key,val){if(Storage.keys.indexOf(key)<0){Storage.keys.push(key);}
Storage.data[key]=val;},removeItem:function(key){var pos=Storage.keys.indexOf(key);if(pos>=0){Storage.keys.splice(pos,1);delete Storage.data[key];}},getKeys:function(){return Storage.keys.slice(0);}}}
$(window).on('storage',evhan_storage_changed);return{classname:'Dialog',version:'2.3.7',streaming:false,init:dialog_init,inited:dialog_inited,getlibrary:dialog_get_library,open:dialog_open,file_clean_fixed_name:file_clean_fixed_name,file_construct_ref:file_construct_ref,file_construct_temp_ref:file_construct_temp_ref,file_ref_exists:file_ref_exists,file_remove_ref:file_remove_ref,file_write:file_write,file_read:file_read,file_fopen:file_notimplemented,autosave_write:autosave_write,autosave_read:autosave_read};};var Dialog=new DialogClass();try{exports.Dialog=Dialog;exports.DialogClass=DialogClass;}catch(ex){};'use strict';var BlorbClass=function(){var inited=false;var metadata={};var coverimageres=undefined;var debug_info=null;var blorbchunks={};function blorb_init(data,opts){if(inited){throw new Error('Blorb: already inited');}
var format=null;var retainuses=true;if(opts&&opts.format!==undefined)
format=opts.format;if(opts&&opts.retainuses!==undefined)
retainuses=opts.retainuses;if(format=='infomap'){var chunkls=[];var pat_numeric=new RegExp('^[0-9]+$');for(var key in data){if(!(''+key).match(pat_numeric)){continue;}
var chunk=Object.assign({},data[key]);var usagenum=1*key;if(chunk.image!==undefined&&chunk.image!=usagenum){}
delete chunk.image;chunk.usage='pict';chunk.usagenum=usagenum;if(chunk.width!==undefined&&chunk.height!==undefined){chunk.imagesize={width:chunk.width,height:chunk.height};}
delete chunk.width;delete chunk.height;chunkls.push(chunk);}
format=null;data=chunkls;}
if(!format){for(var obj of data){var chunk=Object.assign({},obj);var key=chunk.usage+':'+chunk.usagenum;if(chunk.usage=='pict'&&chunk.coverimage){if(coverimageres==null){coverimageres=chunk.usagenum;}}
blorbchunks[key]=chunk;}
inited=true;return;}
if(format!='blorbbytes'){throw new Error('Blorb: unrecognized format');}
var alttexts={};var image=data;var len=image.length;var ix;var rindex=[];var pos=12;while(pos<len){var chunktype=String.fromCharCode(image[pos+0],image[pos+1],image[pos+2],image[pos+3]);pos+=4;var chunklen=(image[pos+0]<<24)|(image[pos+1]<<16)|(image[pos+2]<<8)|(image[pos+3]);pos+=4;if(chunktype=="RIdx"){var npos=pos;var numchunks=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;for(ix=0;ix<numchunks;ix++){var chunkusage=String.fromCharCode(image[npos+0],image[npos+1],image[npos+2],image[npos+3]);npos+=4;var chunknum=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;var chunkpos=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;rindex.push({blorbusage:chunkusage,usagenum:chunknum,blorbpos:chunkpos});}}
if(chunktype=="IFmd"){var arr=image.slice(pos,pos+chunklen);var dat=encode_utf8_text(arr);var met=$('<metadata>').html(dat);var identels=met.find('identification').children();if(identels.length){var el;for(ix=0;ix<identels.length;ix++){el=identels[ix];var key=el.tagName.toLowerCase();if(!metadata[key])
metadata[key]=el.textContent;}}
var bibels=met.find('bibliographic').children();if(bibels.length){var el;for(ix=0;ix<bibels.length;ix++){el=bibels[ix];var key=el.tagName.toLowerCase();if(!metadata[key])
metadata[key]=el.textContent;}}}
if(chunktype=="Dbug"){if(all_options.debug_info_chunk){var arr=image.slice(pos,pos+chunklen);debug_info=arr;}}
if(chunktype=="Fspc"){var npos=pos;coverimageres=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);}
if(chunktype=="RDes"){var npos=pos;var numentries=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;for(ix=0;ix<numentries;ix++){var rdusage=String.fromCharCode.apply(this,image.slice(npos,npos+4));npos+=4;var rdnumber=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;var rdlen=(image[npos+0]<<24)|(image[npos+1]<<16)|(image[npos+2]<<8)|(image[npos+3]);npos+=4;var rdtext=encode_utf8_text(image.slice(npos,npos+rdlen));npos+=rdlen;alttexts[rdusage+':'+rdnumber]=rdtext;}}
pos+=chunklen;if(pos&1)
pos++;}
for(ix=0;ix<rindex.length;ix++){var el=rindex[ix];pos=el.blorbpos;var chunktype=String.fromCharCode(image[pos+0],image[pos+1],image[pos+2],image[pos+3]);pos+=4;var chunklen=(image[pos+0]<<24)|(image[pos+1]<<16)|(image[pos+2]<<8)|(image[pos+3]);pos+=4;el.blorbtype=chunktype;el.blorblen=chunklen;if(el.blorbusage=='Pict'){el.usage='pict';if(el.blorbtype=='JPEG')
el.type='jpeg';else if(el.blorbtype=='PNG ')
el.type='png';else
el.type='????';}
else if(el.blorbusage=='Snd '){el.usage='sound';}
else if(el.blorbusage=='Exec'){el.usage='exec';}
else if(el.blorbusage=='Data'){el.usage='data';el.binary=false;if(el.blorbtype=='BINA'||el.blorbtype=='FORM')
el.binary=true;}
else{el.usage='????';}
var rdtext=alttexts[el.blorbusage+':'+el.usagenum];if(rdtext)
el.alttext=rdtext;el.content=null;var grab=true;if(retainuses===true||retainuses===false)
grab=retainuses;else
grab=retainuses[el.usage];if(grab){if(chunktype=="FORM"){el.content=image.slice(pos-8,pos+chunklen);}
else{el.content=image.slice(pos,pos+chunklen);}}
blorbchunks[el.usage+':'+el.usagenum]=el;}
inited=true;}
function is_inited()
{return inited;}
function get_library(val)
{return null;}
function get_exec_data(gametype)
{var chunk=blorbchunks['exec:0'];if(!chunk){return null;}
if(gametype&&chunk.blorbtype!=gametype){return null;}
return chunk.content;}
function get_metadata(val){return metadata[val];}
function get_cover_pict(){return coverimageres;}
function get_debug_info(){return debug_info;}
function get_chunk(usage,num){var chunk=blorbchunks[usage+':'+num];if(!chunk){return null;}
return chunk;}
function get_image_info(val){var chunk=blorbchunks['pict:'+val];if(!chunk){return null;}
if(chunk.imagesize===undefined&&chunk.content){var imgsize=undefined;if(chunk.type=='jpeg'){imgsize=find_dimensions_jpeg(chunk.content);}
else if(chunk.type=='png'){imgsize=find_dimensions_png(chunk.content);}
if(imgsize){chunk.imagesize=imgsize;}}
var img=Object.assign({},chunk);img.image=val;if(chunk.imagesize){img.width=chunk.imagesize.width;img.height=chunk.imagesize.height;}
return img;}
function get_image_url(val){var chunk=blorbchunks['pict:'+val];if(!chunk){return null;}
if(chunk.url){return chunk.url;}
if(chunk.dataurl){return chunk.dataurl;}
var info=get_image_info(val);if(info&&chunk.content){var mimetype='application/octet-stream';if(chunk.type=='jpeg')
mimetype='image/jpeg';else if(chunk.type=='png')
mimetype='image/png';var b64dat=encode_base64(chunk.content);chunk.dataurl='data:'+mimetype+';base64,'+b64dat;return chunk.dataurl;}
return null;}
function get_data_chunk(val){var chunk=blorbchunks['data:'+val];if(!chunk)
return null;return{data:chunk.content,binary:chunk.binary};}
function encode_base64(image)
{var blocks=[];var imglen=image.length;for(var ix=0;ix<imglen;ix+=16384){blocks.push(String.fromCharCode.apply(String,image.slice(ix,ix+16384)));}
return btoa(blocks.join(''));};function encode_utf8_text(arr){var res=[];var ch;var pos=0;while(pos<arr.length){var val0,val1,val2,val3;if(pos>=arr.length)
break;val0=arr[pos];pos++;if(val0<0x80){ch=val0;}
else{if(pos>=arr.length)
break;val1=arr[pos];pos++;if((val1&0xC0)!=0x80)
break;if((val0&0xE0)==0xC0){ch=(val0&0x1F)<<6;ch|=(val1&0x3F);}
else{if(pos>=arr.length)
break;val2=arr[pos];pos++;if((val2&0xC0)!=0x80)
break;if((val0&0xF0)==0xE0){ch=(((val0&0xF)<<12)&0x0000F000);ch|=(((val1&0x3F)<<6)&0x00000FC0);ch|=(((val2&0x3F))&0x0000003F);}
else if((val0&0xF0)==0xF0){if(pos>=arr.length)
break;val3=arr[pos];pos++;if((val3&0xC0)!=0x80)
break;ch=(((val0&0x7)<<18)&0x1C0000);ch|=(((val1&0x3F)<<12)&0x03F000);ch|=(((val2&0x3F)<<6)&0x000FC0);ch|=(((val3&0x3F))&0x00003F);}
else{break;}}}
res.push(ch);}
return String.fromCharCode.apply(this,res);}
function find_dimensions_png(arr){var pos=0;if(arr[0]!=0x89||String.fromCharCode.apply(this,arr.slice(1,4))!='PNG'){return undefined;}
pos+=8;while(pos<arr.length){var chunklen=(arr[pos+0]<<24)|(arr[pos+1]<<16)|(arr[pos+2]<<8)|(arr[pos+3]);pos+=4;var chunktype=String.fromCharCode.apply(this,arr.slice(pos,pos+4));pos+=4;if(chunktype=='IHDR'){var res={};res.width=(arr[pos+0]<<24)|(arr[pos+1]<<16)|(arr[pos+2]<<8)|(arr[pos+3]);pos+=4;res.height=(arr[pos+0]<<24)|(arr[pos+1]<<16)|(arr[pos+2]<<8)|(arr[pos+3]);pos+=4;return res;}
pos+=chunklen;pos+=4;}
return undefined;}
function find_dimensions_jpeg(arr){var pos=0;while(pos<arr.length){if(arr[pos]!=0xFF){return undefined;}
while(arr[pos]==0xFF)
pos+=1;var marker=arr[pos];pos+=1;if(marker==0x01||(marker>=0xD0&&marker<=0xD9)){continue;}
var chunklen=(arr[pos+0]<<8)|(arr[pos+1]);if(marker>=0xC0&&marker<=0xCF&&marker!=0xC8){if(chunklen<7){return undefined;}
var res={};res.height=(arr[pos+3]<<8)|(arr[pos+4]);res.width=(arr[pos+5]<<8)|(arr[pos+6]);return res;}
pos+=chunklen;}
return undefined;}
return{classname:'Blorb',init:blorb_init,inited:is_inited,getlibrary:get_library,get_chunk:get_chunk,get_exec_data:get_exec_data,get_data_chunk:get_data_chunk,get_metadata:get_metadata,get_cover_pict:get_cover_pict,get_debug_info:get_debug_info,get_image_info:get_image_info,get_image_url:get_image_url};};try{exports.BlorbClass=BlorbClass;}catch(ex){};'use strict';var GlkClass=function(){var GlkOte=null;var VM=null;var GiDispa=null;var Blorb=null;var has_canvas;var option_exit_warning;var option_do_vm_autosave;var option_before_select_hook;var option_extevent_hook;var option_glk_gestalt_hook;var has_exited=false;var ui_disabled=false;var ui_specialinput=null;var ui_specialcallback=null;var event_generation=0;var current_partial_inputs=null;var current_partial_outputs=null;function init(vm_options){if(vm_options.GlkOte){GlkOte=vm_options.GlkOte;}
else if(window.GlkOteClass){GlkOte=new window.GlkOteClass();}
if(vm_options.Blorb){Blorb=vm_options.Blorb;}
has_canvas=(document.createElement('canvas').getContext!=undefined);VM=vm_options.vm;GiDispa=vm_options.GiDispa;vm_options.accept=accept_ui_event;option_exit_warning=vm_options.exit_warning;option_do_vm_autosave=vm_options.do_vm_autosave;option_before_select_hook=vm_options.before_select_hook;option_extevent_hook=vm_options.extevent_hook;option_glk_gestalt_hook=vm_options.glk_gestalt_hook;if(option_before_select_hook){option_before_select_hook();}
if(GiDispa)
GiDispa.init({io:vm_options.io,vm:vm_options.vm});GlkOte.init(vm_options);}
function is_inited(){return(VM!=null&&GlkOte!=null);}
function accept_ui_event(obj){var box;if(ui_disabled){qlog("### ui is disabled, ignoring event");return;}
if(obj.gen!=event_generation){GlkOte.log('Input event had wrong generation number: got '+obj.gen+', currently at '+event_generation);return;}
event_generation+=1;current_partial_inputs=obj.partial;switch(obj.type){case'init':content_metrics=complete_metrics(obj.metrics);VM.start();break;case'external':var res=null;if(option_extevent_hook){res=option_extevent_hook(obj.value);}
if(!res&&obj.value=='timer'){gli_timer_started=Date.now();res={type:Const.evtype_Timer};}
if(res&&res.type){handle_external_input(res);}
break;case'timer':gli_timer_started=Date.now();var res={type:Const.evtype_Timer};handle_external_input(res);break;case'hyperlink':handle_hyperlink_input(obj.window,obj.value);break;case'mouse':handle_mouse_input(obj.window,obj.x,obj.y);break;case'char':handle_char_input(obj.window,obj.value);break;case'line':handle_line_input(obj.window,obj.value,obj.terminator);break;case'arrange':content_metrics=complete_metrics(obj.metrics);box={left:content_metrics.outspacingx,top:content_metrics.outspacingy,right:content_metrics.width-content_metrics.outspacingx,bottom:content_metrics.height-content_metrics.outspacingy};if(gli_rootwin)
gli_window_rearrange(gli_rootwin,box);handle_arrange_input();break;case'redraw':handle_redraw_input();break;case'specialresponse':if(obj.response=='fileref_prompt'){gli_fileref_create_by_prompt_callback(obj);}
break;}}
function complete_metrics(metrics){var res={width:80,height:50,gridcharwidth:1,gridcharheight:1,buffercharwidth:1,buffercharheight:1,gridmarginx:0,gridmarginy:0,buffermarginx:0,buffermarginy:0,graphicsmarginx:0,graphicsmarginy:0,outspacingx:0,outspacingy:0,inspacingx:0,inspacingy:0,};var val;val=metrics.charwidth;if(val!==undefined){res.gridcharwidth=val;res.buffercharwidth=val;}
val=metrics.charheight;if(val!==undefined){res.gridcharheight=val;res.buffercharheight=val;}
val=metrics.margin;if(val!==undefined){res.gridmarginx=val;res.gridmarginy=val;res.buffermarginx=val;res.buffermarginy=val;res.graphicsmarginx=val;res.graphicsmarginy=val;}
val=metrics.gridmargin;if(val!==undefined){res.gridmarginx=val;res.gridmarginy=val;}
val=metrics.buffermargin;if(val!==undefined){res.buffermarginx=val;res.buffermarginy=val;}
val=metrics.graphicsmargin;if(val!==undefined){res.graphicsmarginx=val;res.graphicsmarginy=val;}
val=metrics.marginx;if(val!==undefined){res.gridmarginx=val;res.buffermarginx=val;res.graphicsmarginx=val;}
val=metrics.marginy;if(val!==undefined){res.gridmarginy=val;res.buffermarginy=val;res.graphicsmarginy=val;}
val=metrics.spacing;if(val!==undefined){res.inspacingx=val;res.inspacingy=val;res.outspacingx=val;res.outspacingy=val;}
val=metrics.inspacing;if(val!==undefined){res.inspacingx=val;res.inspacingy=val;}
val=metrics.outspacing;if(val!==undefined){res.outspacingx=val;res.outspacingy=val;}
val=metrics.spacingx;if(val!==undefined){res.inspacingx=val;res.outspacingx=val;}
val=metrics.spacingy;if(val!==undefined){res.inspacingy=val;res.outspacingy=val;}
res=Object.assign(res,metrics);return res;}
function handle_arrange_input(){if(!gli_selectref)
return;gli_selectref.set_field(0,Const.evtype_Arrange);gli_selectref.set_field(1,null);gli_selectref.set_field(2,0);gli_selectref.set_field(3,0);if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_redraw_input(){if(!gli_selectref)
return;gli_selectref.set_field(0,Const.evtype_Redraw);gli_selectref.set_field(1,null);gli_selectref.set_field(2,0);gli_selectref.set_field(3,0);if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_external_input(res){if(!gli_selectref)
return;var val1=0;var val2=0;if(res.val1)
val1=res.val1;if(res.val2)
val2=res.val2;gli_selectref.set_field(0,res.type);gli_selectref.set_field(1,null);gli_selectref.set_field(2,val1);gli_selectref.set_field(3,val2);if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_hyperlink_input(disprock,val){if(!gli_selectref)
return;var win=null;for(win=gli_windowlist;win;win=win.next){if(win.disprock==disprock)
break;}
if(!win||!win.hyperlink_request)
return;gli_selectref.set_field(0,Const.evtype_Hyperlink);gli_selectref.set_field(1,win);gli_selectref.set_field(2,val);gli_selectref.set_field(3,0);win.hyperlink_request=false;if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_mouse_input(disprock,xpos,ypos){if(!gli_selectref)
return;var win=null;for(win=gli_windowlist;win;win=win.next){if(win.disprock==disprock)
break;}
if(!win||!win.mouse_request)
return;gli_selectref.set_field(0,Const.evtype_MouseInput);gli_selectref.set_field(1,win);gli_selectref.set_field(2,xpos);gli_selectref.set_field(3,ypos);win.mouse_request=false;if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_char_input(disprock,input){var charval;if(!gli_selectref)
return;var win=null;for(win=gli_windowlist;win;win=win.next){if(win.disprock==disprock)
break;}
if(!win||!win.char_request)
return;if(input.length==1){charval=input.charCodeAt(0);if(charval>=0x100&&!win.char_request_uni)
charval=Const.keycode_Unknown;}
else{charval=KeystrokeNameMap[input];if(!charval)
charval=Const.keycode_Unknown;}
gli_selectref.set_field(0,Const.evtype_CharInput);gli_selectref.set_field(1,win);gli_selectref.set_field(2,charval);gli_selectref.set_field(3,0);win.char_request=false;win.char_request_uni=false;win.input_generation=null;if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function handle_line_input(disprock,input,termkey){var ix;if(!gli_selectref)
return;var win=null;for(win=gli_windowlist;win;win=win.next){if(win.disprock==disprock)
break;}
if(!win||!win.line_request)
return;if(input.length>win.linebuf.length)
input=input.slice(0,win.linebuf.length);if(win.request_echo_line_input){ix=win.style;gli_set_style(win.str,Const.style_Input);gli_window_put_string(win,input);if(win.echostr)
glk_put_jstring_stream(win.echostr,input);gli_set_style(win.str,ix);gli_window_put_string(win,"\n");if(win.echostr)
glk_put_jstring_stream(win.echostr,"\n");}
for(ix=0;ix<input.length;ix++)
win.linebuf[ix]=input.charCodeAt(ix);var termcode=0;if(termkey&&KeystrokeNameMap[termkey])
termcode=KeystrokeNameMap[termkey];gli_selectref.set_field(0,Const.evtype_LineInput);gli_selectref.set_field(1,win);gli_selectref.set_field(2,input.length);gli_selectref.set_field(3,termcode);if(GiDispa)
GiDispa.unretain_array(win.linebuf);win.line_request=false;win.line_request_uni=false;win.request_echo_line_input=null;win.input_generation=null;win.linebuf=null;if(GiDispa)
GiDispa.prepare_resume(gli_selectref);gli_selectref=null;VM.resume();}
function update(){var dataobj={type:'update',gen:event_generation};var winarray=null;var contentarray=null;var inputarray=null;var win,obj,robj,useobj,lineobj,ls,val,ix,cx;var initial,lastpos,laststyle,lasthyperlink;if(geometry_changed){geometry_changed=false;winarray=[];for(win=gli_windowlist;win;win=win.next){if(win.type==Const.wintype_Pair)
continue;obj={id:win.disprock,rock:win.rock};winarray.push(obj);switch(win.type){case Const.wintype_TextBuffer:obj.type='buffer';break;case Const.wintype_TextGrid:obj.type='grid';obj.gridwidth=win.gridwidth;obj.gridheight=win.gridheight;break;case Const.wintype_Graphics:obj.type='graphics';obj.graphwidth=win.graphwidth;obj.graphheight=win.graphheight;break;}
obj.left=win.bbox.left;obj.top=win.bbox.top;obj.width=win.bbox.right-win.bbox.left;obj.height=win.bbox.bottom-win.bbox.top;}}
for(win=gli_windowlist;win;win=win.next){useobj=false;obj={id:win.disprock};if(contentarray==null)
contentarray=[];switch(win.type){case Const.wintype_TextBuffer:gli_window_buffer_deaccumulate(win);if(win.content.length){obj.text=win.content.slice(0);win.content.length=0;useobj=true;}
if(win.clearcontent){obj.clear=true;win.clearcontent=false;useobj=true;if(!obj.text){obj.text=[];}
win.reserve.length=0;}
if(obj.text&&obj.text.length){for(ix=0;ix<obj.text.length;ix++){win.reserve.push(obj.text[ix]);}}
if(win.reserve.length>100){win.reserve.splice(0,win.reserve.length-100);}
break;case Const.wintype_TextGrid:if(win.gridwidth==0||win.gridheight==0)
break;obj.lines=[];for(ix=0;ix<win.gridheight;ix++){lineobj=win.lines[ix];if(!lineobj.dirty)
continue;lineobj.dirty=false;ls=[];lastpos=0;for(cx=0;cx<win.gridwidth;){laststyle=lineobj.styles[cx];lasthyperlink=lineobj.hyperlinks[cx];for(;cx<win.gridwidth&&lineobj.styles[cx]==laststyle&&lineobj.hyperlinks[cx]==lasthyperlink;cx++){}
if(lastpos<cx){if(!lasthyperlink){ls.push(StyleNameMap[laststyle]);ls.push(lineobj.chars.slice(lastpos,cx).join(''));}
else{robj={style:StyleNameMap[laststyle],text:lineobj.chars.slice(lastpos,cx).join(''),hyperlink:lasthyperlink};ls.push(robj);}
lastpos=cx;}}
obj.lines.push({line:ix,content:ls});}
useobj=obj.lines.length;break;case Const.wintype_Graphics:if(win.content.length){obj.draw=win.content.slice(0);win.content.length=0;useobj=true;}
var clearedat=-1;if(obj.draw&&obj.draw.length){for(ix=0;ix<obj.draw.length;ix++){var drawel=obj.draw[ix];if(drawel.special=='fill'&&drawel.x===undefined&&drawel.y===undefined&&drawel.width===undefined&&drawel.height===undefined){clearedat=win.reserve.length;}
win.reserve.push(drawel);}}
if(clearedat>=0){var setcol=null;for(ix=0;ix<win.reserve.length&&ix<clearedat;ix++){var drawel=win.reserve[ix];if(drawel.special=='setcolor')
setcol=drawel;}
win.reserve.splice(0,clearedat);if(setcol)
win.reserve.unshift(setcol);}
break;}
if(useobj)
contentarray.push(obj);}
inputarray=[];for(win=gli_windowlist;win;win=win.next){obj=null;if(win.char_request){obj={id:win.disprock,type:'char',gen:win.input_generation};if(win.type==Const.wintype_TextGrid){if(gli_window_grid_canonicalize(win)){obj.xpos=win.gridwidth;obj.ypos=win.gridheight-1;}
else{obj.xpos=win.cursorx;obj.ypos=win.cursory;}}}
if(win.line_request){initial='';if(current_partial_outputs){val=current_partial_outputs[win.disprock];if(val)
initial=val;}
obj={id:win.disprock,type:'line',gen:win.input_generation,maxlen:win.linebuf.length,initial:initial};if(win.line_input_terminators.length){obj.terminators=win.line_input_terminators;}
if(win.type==Const.wintype_TextGrid){if(gli_window_grid_canonicalize(win)){obj.xpos=win.gridwidth;obj.ypos=win.gridheight-1;}
else{obj.xpos=win.cursorx;obj.ypos=win.cursory;}}}
if(win.hyperlink_request){if(!obj)
obj={id:win.disprock};obj.hyperlink=true;}
if(win.mouse_request){if(!obj)
obj={id:win.disprock};obj.mouse=true;}
if(obj)
inputarray.push(obj);}
dataobj.windows=winarray;dataobj.content=contentarray;dataobj.input=inputarray;if(gli_timer_lastsent!=gli_timer_interval){dataobj.timer=gli_timer_interval;gli_timer_lastsent=gli_timer_interval;}
if(ui_specialinput){dataobj.specialinput=ui_specialinput;}
if(ui_disabled){dataobj.disable=true;}
if(has_exited){dataobj.exit=true;}
current_partial_outputs=null;if(gli_autorestore_glkstate)
dataobj.autorestore=gli_autorestore_glkstate;gli_autorestore_glkstate=null;GlkOte.update(dataobj,gli_autorestore_glkstate);if(option_before_select_hook){option_before_select_hook();}
if(option_do_vm_autosave){if(has_exited){VM.do_autosave(-1);}
else{var eventarg=GiDispa.check_autosave();if(eventarg)
VM.do_autosave(eventarg);}}}
function get_library(val){switch(val){case'VM':return VM;case'GlkOte':return GlkOte;case'GiDispa':return GiDispa;case'Blorb':return Blorb;case'Dialog':return GlkOte.getlibrary('Dialog');}
return null;}
function save_allstate(){var Dialog=GlkOte.getlibrary('Dialog');var res={};if(gli_rootwin)
res.rootwin=gli_rootwin.disprock;if(gli_currentstr)
res.currentstr=gli_currentstr.disprock;if(gli_timer_interval)
res.timer_interval=gli_timer_interval;res.windows=[];for(var win=gli_windowlist;win;win=win.next){var obj={type:win.type,rock:win.rock,disprock:win.disprock,style:win.style,hyperlink:win.hyperlink};if(win.parent)
obj.parent=win.parent.disprock;obj.str=win.str.disprock;if(win.echostr)
obj.echostr=win.echostr.disprock;obj.bbox={left:win.bbox.left,right:win.bbox.right,top:win.bbox.top,bottom:win.bbox.bottom};if(win.linebuf!==null){var info=GiDispa.get_retained_array(win.linebuf);obj.linebuf={addr:info.addr,len:info.len,arr:info.arr.slice(0),arg:info.arg.serialize()};}
obj.char_request=win.char_request;obj.line_request=win.line_request;obj.char_request_uni=win.char_request_uni;obj.line_request_uni=win.line_request_uni;obj.hyperlink_request=win.hyperlink_request;obj.mouse_request=win.mouse_request;obj.echo_line_input=win.echo_line_input;obj.request_echo_line_input=win.request_echo_line_input;obj.line_input_terminators=win.line_input_terminators.slice(0);switch(win.type){case Const.wintype_TextBuffer:obj.reserve=win.reserve.slice(0);break;case Const.wintype_TextGrid:obj.gridwidth=win.gridwidth;obj.gridheight=win.gridheight;obj.lines=[];for(var ix=0;ix<win.lines.length;ix++){var ln=win.lines[ix];obj.lines.push({chars:ln.chars.slice(0),styles:ln.styles.slice(0),hyperlinks:ln.hyperlinks.slice(0)});}
obj.cursorx=win.cursorx;obj.cursory=win.cursory;break;case Const.wintype_Graphics:obj.graphwidth=win.graphwidth;obj.graphheight=win.graphheight;obj.reserve=win.reserve.slice(0);break;case Const.wintype_Pair:obj.pair_dir=win.pair_dir;obj.pair_division=win.pair_division;obj.pair_key=win.pair_key.disprock;obj.pair_keydamage=false;obj.pair_size=win.pair_size;obj.pair_hasborder=win.pair_hasborder;obj.pair_vertical=win.pair_vertical;obj.pair_backward=win.pair_backward;obj.child1=win.child1.disprock;obj.child2=win.child2.disprock;break;}
res.windows.push(obj);}
res.streams=[];for(var str=gli_streamlist;str;str=str.next){var obj={type:str.type,rock:str.rock,disprock:str.disprock,unicode:str.unicode,isbinary:str.isbinary,readcount:str.readcount,writecount:str.writecount,readable:str.readable,writable:str.writable,streaming:str.streaming};switch(str.type){case strtype_Window:if(str.win)
obj.win=str.win.disprock;break;case strtype_Memory:if(str.buf!==null){var info=GiDispa.get_retained_array(str.buf);obj.buf={addr:info.addr,len:info.len,arr:info.arr.slice(0),arg:info.arg.serialize()};}
obj.buflen=str.buflen;obj.bufpos=str.bufpos;obj.bufeof=str.bufeof;break;case strtype_Resource:obj.resfilenum=str.resfilenum;obj.buflen=str.buflen;obj.bufpos=str.bufpos;obj.bufeof=str.bufeof;break;case strtype_File:obj.origfmode=str.origfmode;if(!Dialog.streaming){obj.ref=str.ref;gli_stream_flush_file(str);obj.buflen=str.buflen;obj.bufpos=str.bufpos;obj.bufeof=str.bufeof;}
else{str.fstream.fflush();obj.ref=str.ref;obj.filepos=str.fstream.ftell();}
break;}
res.streams.push(obj);}
res.filerefs=[];for(var fref=gli_filereflist;fref;fref=fref.next){var obj={type:fref.type,rock:fref.rock,disprock:fref.disprock,filename:fref.filename,textmode:fref.textmode,filetype:fref.filetype,filetypename:fref.filetypename};obj.ref=fref.ref;res.filerefs.push(obj);}
res.glkote=GlkOte.save_allstate();return res;}
function restore_allstate(res)
{var Dialog=GlkOte.getlibrary('Dialog');if(gli_windowlist||gli_streamlist||gli_filereflist)
throw('restore_allstate: glkapi module has already been launched');for(var ix=res.windows.length-1;ix>=0;ix--){var obj=res.windows[ix];var win={type:obj.type,rock:obj.rock,disprock:obj.disprock,style:obj.style,hyperlink:obj.hyperlink};GiDispa.class_register('window',win,win.disprock);win.prev=null;win.next=gli_windowlist;gli_windowlist=win;if(win.next)
win.next.prev=win;}
for(var ix=res.streams.length-1;ix>=0;ix--){var obj=res.streams[ix];var str={type:obj.type,rock:obj.rock,disprock:obj.disprock,unicode:obj.unicode,isbinary:obj.isbinary,readcount:obj.readcount,writecount:obj.writecount,readable:obj.readable,writable:obj.writable,streaming:obj.streaming};GiDispa.class_register('stream',str,str.disprock);str.prev=null;str.next=gli_streamlist;gli_streamlist=str;if(str.next)
str.next.prev=str;}
for(var ix=res.filerefs.length-1;ix>=0;ix--){var obj=res.filerefs[ix];var fref={type:obj.type,rock:obj.rock,disprock:obj.disprock,filename:obj.filename,textmode:obj.textmode,filetype:obj.filetype,filetypename:obj.filetypename};GiDispa.class_register('fileref',fref,fref.disprock);fref.prev=null;fref.next=gli_filereflist;gli_filereflist=fref;if(fref.next)
fref.next.prev=fref;}
for(var ix=0;ix<res.windows.length;ix++){var obj=res.windows[ix];var win=GiDispa.class_obj_from_id('window',obj.disprock);win.parent=GiDispa.class_obj_from_id('window',obj.parent);win.str=GiDispa.class_obj_from_id('stream',obj.str);win.echostr=GiDispa.class_obj_from_id('stream',obj.echostr);win.bbox={left:obj.bbox.left,right:obj.bbox.right,top:obj.bbox.top,bottom:obj.bbox.bottom};win.input_generation=null;if(obj.char_request||obj.line_request)
win.input_generation=event_generation;win.linebuf=null;if(obj.linebuf!==undefined){win.linebuf=obj.linebuf.arr;GiDispa.retain_array(win.linebuf,obj.linebuf);}
win.char_request=obj.char_request;win.line_request=obj.line_request;win.char_request_uni=obj.char_request_uni;win.line_request_uni=obj.line_request_uni;win.hyperlink_request=obj.hyperlink_request;win.mouse_request=obj.mouse_request;win.echo_line_input=obj.echo_line_input;win.request_echo_line_input=obj.request_echo_line_input;win.line_input_terminators=obj.line_input_terminators.slice(0);switch(win.type){case Const.wintype_TextBuffer:win.accum=[];win.accumstyle=win.style;win.accumhyperlink=win.hyperlink;win.content=obj.reserve.slice(0);win.clearcontent=false;win.reserve=[];break;case Const.wintype_TextGrid:win.gridwidth=obj.gridwidth;win.gridheight=obj.gridheight;win.lines=[];for(var jx=0;jx<obj.lines.length;jx++){var ln=obj.lines[jx];win.lines.push({dirty:true,chars:ln.chars.slice(0),styles:ln.styles.slice(0),hyperlinks:ln.hyperlinks.slice(0)});}
win.cursorx=obj.cursorx;win.cursory=obj.cursory;break;case Const.wintype_Graphics:win.graphwidth=obj.graphwidth;win.graphheight=obj.graphheight;win.content=obj.reserve.slice(0);win.reserve=[];break;case Const.wintype_Pair:win.pair_dir=obj.pair_dir;win.pair_division=obj.pair_division;win.pair_key=GiDispa.class_obj_from_id('window',obj.pair_key);win.pair_keydamage=false;win.pair_size=obj.pair_size;win.pair_hasborder=obj.pair_hasborder;win.pair_vertical=obj.pair_vertical;win.pair_backward=obj.pair_backward;win.child1=GiDispa.class_obj_from_id('window',obj.child1);win.child2=GiDispa.class_obj_from_id('window',obj.child2);break;}}
for(var ix=0;ix<res.streams.length;ix++){var obj=res.streams[ix];var str=GiDispa.class_obj_from_id('stream',obj.disprock);str.win=null;str.ref=null;str.file=null;str.buf=null;str.bufpos=0;str.buflen=0;str.bufeof=0;str.timer_id=null;str.flush_func=null;str.fstream=null;switch(str.type){case strtype_Window:str.win=GiDispa.class_obj_from_id('window',obj.win);break;case strtype_Memory:if(obj.buf!==undefined){str.buf=obj.buf.arr;GiDispa.retain_array(str.buf,obj.buf);}
str.buflen=obj.buflen;str.bufpos=obj.bufpos;str.bufeof=obj.bufeof;break;case strtype_Resource:str.resfilenum=obj.resfilenum;var el=Blorb.get_data_chunk(str.resfilenum);if(el){str.buf=el.data;}
str.buflen=obj.buflen;str.bufpos=obj.bufpos;str.bufeof=obj.bufeof;break;case strtype_File:str.origfmode=obj.origfmode;if(!Dialog.streaming){str.ref=obj.ref;str.buflen=obj.buflen;str.bufpos=obj.bufpos;str.bufeof=obj.bufeof;var content=Dialog.file_read(str.ref);if(content==null){content=[];Dialog.file_write(str.ref,'',true);}
str.buf=content;str.bufeof=content.length;if(str.bufpos>str.bufeof)
str.bufpos=str.bufeof;}
else{str.ref=obj.ref;str.fstream=Dialog.file_fopen(str.origfmode,str.ref);if(!str.fstream){var tempref=Dialog.file_construct_temp_ref(str.ref.usage);str.fstream=Dialog.file_fopen(str.origfmode,tempref);if(!str.fstream)
throw('restore_allstate: could not reopen even a temp stream for: '+str.ref.filename);}
if(str.origfmode!=Const.filemode_WriteAppend){str.fstream.fseek(obj.filepos,Const.seekmode_Start);}
str.buffer4=str.fstream.BufferClass.alloc(4);}
break;}}
for(var ix=0;ix<res.filerefs.length;ix++){var obj=res.filerefs[ix];var fref=GiDispa.class_obj_from_id('fileref',obj.disprock);fref.ref=obj.ref;}
gli_rootwin=GiDispa.class_obj_from_id('window',res.rootwin);gli_currentstr=GiDispa.class_obj_from_id('stream',res.currentstr);if(res.timer_interval)
glk_request_timer_events(res.timer_interval);gli_autorestore_glkstate=res.glkote;}
function fatal_error(msg){has_exited=true;ui_disabled=true;if(!GlkOte){console.log('Fatal error:',msg);return;}
GlkOte.error(msg);var dataobj={type:'update',gen:event_generation,disable:true};dataobj.input=[];GlkOte.update(dataobj);}
var Const={gestalt_Version:0,gestalt_CharInput:1,gestalt_LineInput:2,gestalt_CharOutput:3,gestalt_CharOutput_CannotPrint:0,gestalt_CharOutput_ApproxPrint:1,gestalt_CharOutput_ExactPrint:2,gestalt_MouseInput:4,gestalt_Timer:5,gestalt_Graphics:6,gestalt_DrawImage:7,gestalt_Sound:8,gestalt_SoundVolume:9,gestalt_SoundNotify:10,gestalt_Hyperlinks:11,gestalt_HyperlinkInput:12,gestalt_SoundMusic:13,gestalt_GraphicsTransparency:14,gestalt_Unicode:15,gestalt_UnicodeNorm:16,gestalt_LineInputEcho:17,gestalt_LineTerminators:18,gestalt_LineTerminatorKey:19,gestalt_DateTime:20,gestalt_Sound2:21,gestalt_ResourceStream:22,gestalt_GraphicsCharInput:23,gestalt_DrawImageScale:24,keycode_Unknown:0xffffffff,keycode_Left:0xfffffffe,keycode_Right:0xfffffffd,keycode_Up:0xfffffffc,keycode_Down:0xfffffffb,keycode_Return:0xfffffffa,keycode_Delete:0xfffffff9,keycode_Escape:0xfffffff8,keycode_Tab:0xfffffff7,keycode_PageUp:0xfffffff6,keycode_PageDown:0xfffffff5,keycode_Home:0xfffffff4,keycode_End:0xfffffff3,keycode_Func1:0xffffffef,keycode_Func2:0xffffffee,keycode_Func3:0xffffffed,keycode_Func4:0xffffffec,keycode_Func5:0xffffffeb,keycode_Func6:0xffffffea,keycode_Func7:0xffffffe9,keycode_Func8:0xffffffe8,keycode_Func9:0xffffffe7,keycode_Func10:0xffffffe6,keycode_Func11:0xffffffe5,keycode_Func12:0xffffffe4,keycode_MAXVAL:28,evtype_None:0,evtype_Timer:1,evtype_CharInput:2,evtype_LineInput:3,evtype_MouseInput:4,evtype_Arrange:5,evtype_Redraw:6,evtype_SoundNotify:7,evtype_Hyperlink:8,evtype_VolumeNotify:9,style_Normal:0,style_Emphasized:1,style_Preformatted:2,style_Header:3,style_Subheader:4,style_Alert:5,style_Note:6,style_BlockQuote:7,style_Input:8,style_User1:9,style_User2:10,style_NUMSTYLES:11,wintype_AllTypes:0,wintype_Pair:1,wintype_Blank:2,wintype_TextBuffer:3,wintype_TextGrid:4,wintype_Graphics:5,winmethod_Left:0x00,winmethod_Right:0x01,winmethod_Above:0x02,winmethod_Below:0x03,winmethod_DirMask:0x0f,winmethod_Fixed:0x10,winmethod_Proportional:0x20,winmethod_DivisionMask:0xf0,winmethod_Border:0x000,winmethod_NoBorder:0x100,winmethod_BorderMask:0x100,fileusage_Data:0x00,fileusage_SavedGame:0x01,fileusage_Transcript:0x02,fileusage_InputRecord:0x03,fileusage_TypeMask:0x0f,fileusage_TextMode:0x100,fileusage_BinaryMode:0x000,filemode_Write:0x01,filemode_Read:0x02,filemode_ReadWrite:0x03,filemode_WriteAppend:0x05,seekmode_Start:0,seekmode_Current:1,seekmode_End:2,stylehint_Indentation:0,stylehint_ParaIndentation:1,stylehint_Justification:2,stylehint_Size:3,stylehint_Weight:4,stylehint_Oblique:5,stylehint_Proportional:6,stylehint_TextColor:7,stylehint_BackColor:8,stylehint_ReverseColor:9,stylehint_NUMHINTS:10,stylehint_just_LeftFlush:0,stylehint_just_LeftRight:1,stylehint_just_Centered:2,stylehint_just_RightFlush:3,imagealign_InlineUp:1,imagealign_InlineDown:2,imagealign_InlineCenter:3,imagealign_MarginLeft:4,imagealign_MarginRight:5,imagerule_WidthOrig:0x01,imagerule_WidthFixed:0x02,imagerule_WidthRatio:0x03,imagerule_WidthMask:0x03,imagerule_HeightOrig:0x04,imagerule_HeightFixed:0x08,imagerule_AspectRatio:0x0C,imagerule_HeightMask:0x0C,imagerule_WidthWindowMax:0x10};var KeystrokeNameMap={left:Const.keycode_Left,right:Const.keycode_Right,up:Const.keycode_Up,down:Const.keycode_Down,'return':Const.keycode_Return,'delete':Const.keycode_Delete,escape:Const.keycode_Escape,tab:Const.keycode_Tab,pageup:Const.keycode_PageUp,pagedown:Const.keycode_PageDown,home:Const.keycode_Home,end:Const.keycode_End,func1:Const.keycode_Func1,func2:Const.keycode_Func2,func3:Const.keycode_Func3,func4:Const.keycode_Func4,func5:Const.keycode_Func5,func6:Const.keycode_Func6,func7:Const.keycode_Func7,func8:Const.keycode_Func8,func9:Const.keycode_Func9,func10:Const.keycode_Func10,func11:Const.keycode_Func11,func12:Const.keycode_Func12};var KeystrokeValueMap=null;var StyleNameMap={0:'normal',1:'emphasized',2:'preformatted',3:'header',4:'subheader',5:'alert',6:'note',7:'blockquote',8:'input',9:'user1',10:'user2'};var FileTypeMap={0:'data',1:'save',2:'transcript',3:'command'};var unicode_upper_table={181:924,223:[83,83],255:376,305:73,329:[700,78],383:83,405:502,414:544,447:503,454:452,457:455,460:458,477:398,496:[74,780],499:497,595:385,596:390,598:393,599:394,601:399,603:400,608:403,611:404,616:407,617:406,623:412,626:413,629:415,640:422,643:425,648:430,650:433,651:434,658:439,837:921,912:[921,776,769],940:902,941:904,942:905,943:906,944:[933,776,769],962:931,972:908,973:910,974:911,976:914,977:920,981:934,982:928,1008:922,1010:1017,1013:917,1415:[1333,1362],7830:[72,817],7831:[84,776],7832:[87,778],7833:[89,778],7834:[65,702],7835:7776,8016:[933,787],8018:[933,787,768],8020:[933,787,769],8022:[933,787,834],8048:8122,8049:8123,8050:8136,8051:8137,8052:8138,8053:8139,8054:8154,8055:8155,8056:8184,8057:8185,8058:8170,8059:8171,8060:8186,8061:8187,8064:[7944,921],8065:[7945,921],8066:[7946,921],8067:[7947,921],8068:[7948,921],8069:[7949,921],8070:[7950,921],8071:[7951,921],8072:[7944,921],8073:[7945,921],8074:[7946,921],8075:[7947,921],8076:[7948,921],8077:[7949,921],8078:[7950,921],8079:[7951,921],8080:[7976,921],8081:[7977,921],8082:[7978,921],8083:[7979,921],8084:[7980,921],8085:[7981,921],8086:[7982,921],8087:[7983,921],8088:[7976,921],8089:[7977,921],8090:[7978,921],8091:[7979,921],8092:[7980,921],8093:[7981,921],8094:[7982,921],8095:[7983,921],8096:[8040,921],8097:[8041,921],8098:[8042,921],8099:[8043,921],8100:[8044,921],8101:[8045,921],8102:[8046,921],8103:[8047,921],8104:[8040,921],8105:[8041,921],8106:[8042,921],8107:[8043,921],8108:[8044,921],8109:[8045,921],8110:[8046,921],8111:[8047,921],8114:[8122,921],8115:[913,921],8116:[902,921],8118:[913,834],8119:[913,834,921],8124:[913,921],8126:921,8130:[8138,921],8131:[919,921],8132:[905,921],8134:[919,834],8135:[919,834,921],8140:[919,921],8146:[921,776,768],8147:[921,776,769],8150:[921,834],8151:[921,776,834],8162:[933,776,768],8163:[933,776,769],8164:[929,787],8165:8172,8166:[933,834],8167:[933,776,834],8178:[8186,921],8179:[937,921],8180:[911,921],8182:[937,834],8183:[937,834,921],8188:[937,921],64256:[70,70],64257:[70,73],64258:[70,76],64259:[70,70,73],64260:[70,70,76],64261:[83,84],64262:[83,84],64275:[1348,1350],64276:[1348,1333],64277:[1348,1339],64278:[1358,1350],64279:[1348,1341]};(function(){var ls,ix,val;var map=unicode_upper_table;ls=[7936,7937,7938,7939,7940,7941,7942,7943,7952,7953,7954,7955,7956,7957,7968,7969,7970,7971,7972,7973,7974,7975,7984,7985,7986,7987,7988,7989,7990,7991,8000,8001,8002,8003,8004,8005,8017,8019,8021,8023,8032,8033,8034,8035,8036,8037,8038,8039,8112,8113,8144,8145,8160,8161,];for(ix=0;ix<54;ix++){val=ls[ix];map[val]=val+8;}
for(val=257;val<=303;val+=2){map[val]=val-1;}
for(val=331;val<=375;val+=2){map[val]=val-1;}
for(val=505;val<=543;val+=2){map[val]=val-1;}
for(val=1121;val<=1153;val+=2){map[val]=val-1;}
for(val=1163;val<=1215;val+=2){map[val]=val-1;}
for(val=1233;val<=1269;val+=2){map[val]=val-1;}
for(val=7681;val<=7829;val+=2){map[val]=val-1;}
for(val=7841;val<=7929;val+=2){map[val]=val-1;}
ls=[307,309,311,314,316,318,320,322,324,326,328,378,380,382,387,389,392,396,402,409,417,419,421,424,429,432,436,438,441,445,453,456,459,462,464,466,468,470,472,474,476,479,481,483,485,487,489,491,493,495,498,501,547,549,551,553,555,557,559,561,563,985,987,989,991,993,995,997,999,1001,1003,1005,1007,1016,1019,1218,1220,1222,1224,1226,1228,1230,1273,1281,1283,1285,1287,1289,1291,1293,1295,];for(ix=0;ix<91;ix++){val=ls[ix];map[val]=val-1;}
for(val=8560;val<=8575;val+=1){map[val]=val-16;}
for(val=9424;val<=9449;val+=1){map[val]=val-26;}
for(val=97;val<=122;val+=1){map[val]=val-32;}
for(val=224;val<=246;val+=1){map[val]=val-32;}
for(val=945;val<=961;val+=1){map[val]=val-32;}
for(val=1072;val<=1103;val+=1){map[val]=val-32;}
for(val=65345;val<=65370;val+=1){map[val]=val-32;}
ls=[248,249,250,251,252,253,254,963,964,965,966,967,968,969,970,971,];for(ix=0;ix<16;ix++){val=ls[ix];map[val]=val-32;}
for(val=66600;val<=66639;val+=1){map[val]=val-40;}
for(val=1377;val<=1414;val+=1){map[val]=val-48;}
for(val=1104;val<=1119;val+=1){map[val]=val-80;}
map[1009]=929;})();var unicode_lower_table={304:[105,775],376:255,385:595,390:596,393:598,394:599,398:477,399:601,400:603,403:608,404:611,406:617,407:616,412:623,413:626,415:629,422:640,425:643,430:648,433:650,434:651,439:658,452:454,455:457,458:460,497:499,502:405,503:447,544:414,902:940,904:941,905:942,906:943,908:972,910:973,911:974,1012:952,1017:1010,8122:8048,8123:8049,8124:8115,8136:8050,8137:8051,8138:8052,8139:8053,8140:8131,8154:8054,8155:8055,8170:8058,8171:8059,8172:8165,8184:8056,8185:8057,8186:8060,8187:8061,8188:8179,8486:969,8490:107,8491:229};(function(){var ls,ix,val;var map=unicode_lower_table;for(val=1024;val<=1039;val+=1){map[val]=val+80;}
for(val=1329;val<=1366;val+=1){map[val]=val+48;}
for(val=66560;val<=66599;val+=1){map[val]=val+40;}
for(val=65;val<=90;val+=1){map[val]=val+32;}
for(val=192;val<=214;val+=1){map[val]=val+32;}
for(val=913;val<=929;val+=1){map[val]=val+32;}
for(val=1040;val<=1071;val+=1){map[val]=val+32;}
for(val=65313;val<=65338;val+=1){map[val]=val+32;}
ls=[216,217,218,219,220,221,222,931,932,933,934,935,936,937,938,939,];for(ix=0;ix<16;ix++){val=ls[ix];map[val]=val+32;}
for(val=9398;val<=9423;val+=1){map[val]=val+26;}
for(val=8544;val<=8559;val+=1){map[val]=val+16;}
for(val=256;val<=302;val+=2){map[val]=val+1;}
for(val=330;val<=374;val+=2){map[val]=val+1;}
for(val=504;val<=542;val+=2){map[val]=val+1;}
for(val=1120;val<=1152;val+=2){map[val]=val+1;}
for(val=1162;val<=1214;val+=2){map[val]=val+1;}
for(val=1232;val<=1268;val+=2){map[val]=val+1;}
for(val=7680;val<=7828;val+=2){map[val]=val+1;}
for(val=7840;val<=7928;val+=2){map[val]=val+1;}
ls=[306,308,310,313,315,317,319,321,323,325,327,377,379,381,386,388,391,395,401,408,416,418,420,423,428,431,435,437,440,444,453,456,459,461,463,465,467,469,471,473,475,478,480,482,484,486,488,490,492,494,498,500,546,548,550,552,554,556,558,560,562,984,986,988,990,992,994,996,998,1000,1002,1004,1006,1015,1018,1217,1219,1221,1223,1225,1227,1229,1272,1280,1282,1284,1286,1288,1290,1292,1294,];for(ix=0;ix<91;ix++){val=ls[ix];map[val]=val+1;}
ls=[7944,7945,7946,7947,7948,7949,7950,7951,7960,7961,7962,7963,7964,7965,7976,7977,7978,7979,7980,7981,7982,7983,7992,7993,7994,7995,7996,7997,7998,7999,8008,8009,8010,8011,8012,8013,8025,8027,8029,8031,8040,8041,8042,8043,8044,8045,8046,8047,8072,8073,8074,8075,8076,8077,8078,8079,8088,8089,8090,8091,8092,8093,8094,8095,8104,8105,8106,8107,8108,8109,8110,8111,8120,8121,8152,8153,8168,8169,];for(ix=0;ix<78;ix++){val=ls[ix];map[val]=val-8;}})();var unicode_title_table={223:[83,115],452:453,453:453,454:453,455:456,456:456,457:456,458:459,459:459,460:459,497:498,498:498,499:498,1415:[1333,1410],8114:[8122,837],8115:8124,8116:[902,837],8119:[913,834,837],8124:8124,8130:[8138,837],8131:8140,8132:[905,837],8135:[919,834,837],8140:8140,8178:[8186,837],8179:8188,8180:[911,837],8183:[937,834,837],8188:8188,64256:[70,102],64257:[70,105],64258:[70,108],64259:[70,102,105],64260:[70,102,108],64261:[83,116],64262:[83,116],64275:[1348,1398],64276:[1348,1381],64277:[1348,1387],64278:[1358,1398],64279:[1348,1389]};(function(){var ls,ix,val;var map=unicode_title_table;ls=[8072,8073,8074,8075,8076,8077,8078,8079,8072,8073,8074,8075,8076,8077,8078,8079,8088,8089,8090,8091,8092,8093,8094,8095,8088,8089,8090,8091,8092,8093,8094,8095,8104,8105,8106,8107,8108,8109,8110,8111,8104,8105,8106,8107,8108,8109,8110,8111,];for(ix=0;ix<48;ix++){val=ls[ix];map[ix+8064]=val;}})();var unicode_decomp_table={192:[65,768],193:[65,769],194:[65,770],195:[65,771],196:[65,776],197:[65,778],199:[67,807],200:[69,768],201:[69,769],202:[69,770],203:[69,776],204:[73,768],205:[73,769],206:[73,770],207:[73,776],209:[78,771],210:[79,768],211:[79,769],212:[79,770],213:[79,771],214:[79,776],217:[85,768],218:[85,769],219:[85,770],220:[85,776],221:[89,769],224:[97,768],225:[97,769],226:[97,770],227:[97,771],228:[97,776],229:[97,778],231:[99,807],232:[101,768],233:[101,769],234:[101,770],235:[101,776],236:[105,768],237:[105,769],238:[105,770],239:[105,776],241:[110,771],242:[111,768],243:[111,769],244:[111,770],245:[111,771],246:[111,776],249:[117,768],250:[117,769],251:[117,770],252:[117,776],253:[121,769],296:[73,771],297:[105,771],298:[73,772],299:[105,772],300:[73,774],301:[105,774],302:[73,808],303:[105,808],304:[73,775],308:[74,770],309:[106,770],310:[75,807],311:[107,807],313:[76,769],314:[108,769],315:[76,807],316:[108,807],317:[76,780],318:[108,780],323:[78,769],324:[110,769],325:[78,807],326:[110,807],327:[78,780],328:[110,780],332:[79,772],333:[111,772],334:[79,774],335:[111,774],336:[79,779],337:[111,779],416:[79,795],417:[111,795],431:[85,795],432:[117,795],478:[65,776,772],479:[97,776,772],480:[65,775,772],481:[97,775,772],482:[198,772],483:[230,772],486:[71,780],487:[103,780],488:[75,780],489:[107,780],490:[79,808],491:[111,808],492:[79,808,772],493:[111,808,772],494:[439,780],495:[658,780],496:[106,780],500:[71,769],501:[103,769],542:[72,780],543:[104,780],550:[65,775],551:[97,775],552:[69,807],553:[101,807],554:[79,776,772],555:[111,776,772],556:[79,771,772],557:[111,771,772],558:[79,775],559:[111,775],560:[79,775,772],561:[111,775,772],562:[89,772],563:[121,772],832:768,833:769,835:787,836:[776,769],884:697,894:59,901:[168,769],902:[913,769],903:183,904:[917,769],905:[919,769],906:[921,769],908:[927,769],910:[933,769],911:[937,769],912:[953,776,769],938:[921,776],939:[933,776],940:[945,769],941:[949,769],942:[951,769],943:[953,769],944:[965,776,769],970:[953,776],971:[965,776],972:[959,769],973:[965,769],974:[969,769],979:[978,769],980:[978,776],1024:[1045,768],1025:[1045,776],1027:[1043,769],1031:[1030,776],1036:[1050,769],1037:[1048,768],1038:[1059,774],1049:[1048,774],1081:[1080,774],1104:[1077,768],1105:[1077,776],1107:[1075,769],1111:[1110,776],1116:[1082,769],1117:[1080,768],1118:[1091,774],1142:[1140,783],1143:[1141,783],1217:[1046,774],1218:[1078,774],1232:[1040,774],1233:[1072,774],1234:[1040,776],1235:[1072,776],1238:[1045,774],1239:[1077,774],1242:[1240,776],1243:[1241,776],1244:[1046,776],1245:[1078,776],1246:[1047,776],1247:[1079,776],1250:[1048,772],1251:[1080,772],1252:[1048,776],1253:[1080,776],1254:[1054,776],1255:[1086,776],1258:[1256,776],1259:[1257,776],1260:[1069,776],1261:[1101,776],1262:[1059,772],1263:[1091,772],1264:[1059,776],1265:[1091,776],1266:[1059,779],1267:[1091,779],1268:[1063,776],1269:[1095,776],1272:[1067,776],1273:[1099,776],1570:[1575,1619],1571:[1575,1620],1572:[1608,1620],1573:[1575,1621],1574:[1610,1620],1728:[1749,1620],1730:[1729,1620],1747:[1746,1620],2345:[2344,2364],2353:[2352,2364],2356:[2355,2364],2392:[2325,2364],2393:[2326,2364],2394:[2327,2364],2395:[2332,2364],2396:[2337,2364],2397:[2338,2364],2398:[2347,2364],2399:[2351,2364],2507:[2503,2494],2508:[2503,2519],2524:[2465,2492],2525:[2466,2492],2527:[2479,2492],2611:[2610,2620],2614:[2616,2620],2649:[2582,2620],2650:[2583,2620],2651:[2588,2620],2654:[2603,2620],2888:[2887,2902],2891:[2887,2878],2892:[2887,2903],2908:[2849,2876],2909:[2850,2876],2964:[2962,3031],3018:[3014,3006],3019:[3015,3006],3020:[3014,3031],3144:[3142,3158],3264:[3263,3285],3271:[3270,3285],3272:[3270,3286],3274:[3270,3266],3275:[3270,3266,3285],3402:[3398,3390],3403:[3399,3390],3404:[3398,3415],3546:[3545,3530],3548:[3545,3535],3549:[3545,3535,3530],3550:[3545,3551],3907:[3906,4023],3917:[3916,4023],3922:[3921,4023],3927:[3926,4023],3932:[3931,4023],3945:[3904,4021],3955:[3953,3954],3957:[3953,3956],3958:[4018,3968],3960:[4019,3968],3969:[3953,3968],3987:[3986,4023],3997:[3996,4023],4002:[4001,4023],4007:[4006,4023],4012:[4011,4023],4025:[3984,4021],4134:[4133,4142],7835:[383,775],7960:[917,787],7961:[917,788],7962:[917,787,768],7963:[917,788,768],7964:[917,787,769],7965:[917,788,769],8008:[927,787],8009:[927,788],8010:[927,787,768],8011:[927,788,768],8012:[927,787,769],8013:[927,788,769],8016:[965,787],8017:[965,788],8018:[965,787,768],8019:[965,788,768],8020:[965,787,769],8021:[965,788,769],8022:[965,787,834],8023:[965,788,834],8025:[933,788],8027:[933,788,768],8029:[933,788,769],8118:[945,834],8119:[945,834,837],8120:[913,774],8121:[913,772],8122:[913,768],8123:[913,769],8124:[913,837],8126:953,8129:[168,834],8130:[951,768,837],8131:[951,837],8132:[951,769,837],8134:[951,834],8135:[951,834,837],8136:[917,768],8137:[917,769],8138:[919,768],8139:[919,769],8140:[919,837],8141:[8127,768],8142:[8127,769],8143:[8127,834],8144:[953,774],8145:[953,772],8146:[953,776,768],8147:[953,776,769],8150:[953,834],8151:[953,776,834],8152:[921,774],8153:[921,772],8154:[921,768],8155:[921,769],8178:[969,768,837],8179:[969,837],8180:[969,769,837],8182:[969,834],8183:[969,834,837],8184:[927,768],8185:[927,769],8186:[937,768],8187:[937,769],8188:[937,837],8189:180,8192:8194,8193:8195,8486:937,8490:75,8491:[65,778],8602:[8592,824],8603:[8594,824],8622:[8596,824],8653:[8656,824],8654:[8660,824],8655:[8658,824],8708:[8707,824],8713:[8712,824],8716:[8715,824],8740:[8739,824],8742:[8741,824],8769:[8764,824],8772:[8771,824],8775:[8773,824],8777:[8776,824],8800:[61,824],8802:[8801,824],8813:[8781,824],8814:[60,824],8815:[62,824],8816:[8804,824],8817:[8805,824],8820:[8818,824],8821:[8819,824],8824:[8822,824],8825:[8823,824],8832:[8826,824],8833:[8827,824],8836:[8834,824],8837:[8835,824],8840:[8838,824],8841:[8839,824],8876:[8866,824],8877:[8872,824],8878:[8873,824],8879:[8875,824],8928:[8828,824],8929:[8829,824],8930:[8849,824],8931:[8850,824],8938:[8882,824],8939:[8883,824],8940:[8884,824],8941:[8885,824],9001:12296,9002:12297,10972:[10973,824],12364:[12363,12441],12366:[12365,12441],12368:[12367,12441],12370:[12369,12441],12372:[12371,12441],12374:[12373,12441],12376:[12375,12441],12378:[12377,12441],12380:[12379,12441],12382:[12381,12441],12384:[12383,12441],12386:[12385,12441],12389:[12388,12441],12391:[12390,12441],12393:[12392,12441],12400:[12399,12441],12401:[12399,12442],12403:[12402,12441],12404:[12402,12442],12406:[12405,12441],12407:[12405,12442],12409:[12408,12441],12410:[12408,12442],12412:[12411,12441],12413:[12411,12442],12436:[12358,12441],12446:[12445,12441],12460:[12459,12441],12462:[12461,12441],12464:[12463,12441],12466:[12465,12441],12468:[12467,12441],12470:[12469,12441],12472:[12471,12441],12474:[12473,12441],12476:[12475,12441],12478:[12477,12441],12480:[12479,12441],12482:[12481,12441],12485:[12484,12441],12487:[12486,12441],12489:[12488,12441],12496:[12495,12441],12497:[12495,12442],12499:[12498,12441],12500:[12498,12442],12502:[12501,12441],12503:[12501,12442],12505:[12504,12441],12506:[12504,12442],12508:[12507,12441],12509:[12507,12442],12532:[12454,12441],12535:[12527,12441],12536:[12528,12441],12537:[12529,12441],12538:[12530,12441],12542:[12541,12441],64016:22618,64018:26228,64021:20958,64022:29482,64023:30410,64024:31036,64025:31070,64026:31077,64027:31119,64028:38742,64029:31934,64030:32701,64032:34322,64034:35576,64037:36920,64038:37117,64042:39151,64043:39164,64044:39208,64045:40372,64285:[1497,1460],64287:[1522,1463],64298:[1513,1473],64299:[1513,1474],64300:[1513,1468,1473],64301:[1513,1468,1474],64302:[1488,1463],64303:[1488,1464],64304:[1488,1468],64305:[1489,1468],64306:[1490,1468],64307:[1491,1468],64308:[1492,1468],64309:[1493,1468],64310:[1494,1468],64312:[1496,1468],64313:[1497,1468],64314:[1498,1468],64315:[1499,1468],64316:[1500,1468],64318:[1502,1468],64320:[1504,1468],64321:[1505,1468],64323:[1507,1468],64324:[1508,1468],64326:[1510,1468],64327:[1511,1468],64328:[1512,1468],64329:[1513,1468],64330:[1514,1468],64331:[1493,1465],64332:[1489,1471],64333:[1499,1471],64334:[1508,1471],119134:[119127,119141],119135:[119128,119141],119136:[119128,119141,119150],119137:[119128,119141,119151],119138:[119128,119141,119152],119139:[119128,119141,119153],119140:[119128,119141,119154],119227:[119225,119141],119228:[119226,119141],119229:[119225,119141,119150],119230:[119226,119141,119150],119231:[119225,119141,119151],119232:[119226,119141,119151]};(function(){var ls,ix,val;var map=unicode_decomp_table;ls=[[121,776],[65,772],[97,772],[65,774],[97,774],[65,808],[97,808],[67,769],[99,769],[67,770],[99,770],[67,775],[99,775],[67,780],[99,780],[68,780],[100,780],];for(ix=0;ix<17;ix++){val=ls[ix];map[ix+255]=val;}
ls=[[69,772],[101,772],[69,774],[101,774],[69,775],[101,775],[69,808],[101,808],[69,780],[101,780],[71,770],[103,770],[71,774],[103,774],[71,775],[103,775],[71,807],[103,807],[72,770],[104,770],];for(ix=0;ix<20;ix++){val=ls[ix];map[ix+274]=val;}
ls=[[82,769],[114,769],[82,807],[114,807],[82,780],[114,780],[83,769],[115,769],[83,770],[115,770],[83,807],[115,807],[83,780],[115,780],[84,807],[116,807],[84,780],[116,780],];for(ix=0;ix<18;ix++){val=ls[ix];map[ix+340]=val;}
ls=[[85,771],[117,771],[85,772],[117,772],[85,774],[117,774],[85,778],[117,778],[85,779],[117,779],[85,808],[117,808],[87,770],[119,770],[89,770],[121,770],[89,776],[90,769],[122,769],[90,775],[122,775],[90,780],[122,780],];for(ix=0;ix<23;ix++){val=ls[ix];map[ix+360]=val;}
ls=[[65,780],[97,780],[73,780],[105,780],[79,780],[111,780],[85,780],[117,780],[85,776,772],[117,776,772],[85,776,769],[117,776,769],[85,776,780],[117,776,780],[85,776,768],[117,776,768],];for(ix=0;ix<16;ix++){val=ls[ix];map[ix+461]=val;}
ls=[[78,768],[110,768],[65,778,769],[97,778,769],[198,769],[230,769],[216,769],[248,769],[65,783],[97,783],[65,785],[97,785],[69,783],[101,783],[69,785],[101,785],[73,783],[105,783],[73,785],[105,785],[79,783],[111,783],[79,785],[111,785],[82,783],[114,783],[82,785],[114,785],[85,783],[117,783],[85,785],[117,785],[83,806],[115,806],[84,806],[116,806],];for(ix=0;ix<36;ix++){val=ls[ix];map[ix+504]=val;}
ls=[[65,805],[97,805],[66,775],[98,775],[66,803],[98,803],[66,817],[98,817],[67,807,769],[99,807,769],[68,775],[100,775],[68,803],[100,803],[68,817],[100,817],[68,807],[100,807],[68,813],[100,813],[69,772,768],[101,772,768],[69,772,769],[101,772,769],[69,813],[101,813],[69,816],[101,816],[69,807,774],[101,807,774],[70,775],[102,775],[71,772],[103,772],[72,775],[104,775],[72,803],[104,803],[72,776],[104,776],[72,807],[104,807],[72,814],[104,814],[73,816],[105,816],[73,776,769],[105,776,769],[75,769],[107,769],[75,803],[107,803],[75,817],[107,817],[76,803],[108,803],[76,803,772],[108,803,772],[76,817],[108,817],[76,813],[108,813],[77,769],[109,769],[77,775],[109,775],[77,803],[109,803],[78,775],[110,775],[78,803],[110,803],[78,817],[110,817],[78,813],[110,813],[79,771,769],[111,771,769],[79,771,776],[111,771,776],[79,772,768],[111,772,768],[79,772,769],[111,772,769],[80,769],[112,769],[80,775],[112,775],[82,775],[114,775],[82,803],[114,803],[82,803,772],[114,803,772],[82,817],[114,817],[83,775],[115,775],[83,803],[115,803],[83,769,775],[115,769,775],[83,780,775],[115,780,775],[83,803,775],[115,803,775],[84,775],[116,775],[84,803],[116,803],[84,817],[116,817],[84,813],[116,813],[85,804],[117,804],[85,816],[117,816],[85,813],[117,813],[85,771,769],[117,771,769],[85,772,776],[117,772,776],[86,771],[118,771],[86,803],[118,803],[87,768],[119,768],[87,769],[119,769],[87,776],[119,776],[87,775],[119,775],[87,803],[119,803],[88,775],[120,775],[88,776],[120,776],[89,775],[121,775],[90,770],[122,770],[90,803],[122,803],[90,817],[122,817],[104,817],[116,776],[119,778],[121,778],];for(ix=0;ix<154;ix++){val=ls[ix];map[ix+7680]=val;}
ls=[[65,803],[97,803],[65,777],[97,777],[65,770,769],[97,770,769],[65,770,768],[97,770,768],[65,770,777],[97,770,777],[65,770,771],[97,770,771],[65,803,770],[97,803,770],[65,774,769],[97,774,769],[65,774,768],[97,774,768],[65,774,777],[97,774,777],[65,774,771],[97,774,771],[65,803,774],[97,803,774],[69,803],[101,803],[69,777],[101,777],[69,771],[101,771],[69,770,769],[101,770,769],[69,770,768],[101,770,768],[69,770,777],[101,770,777],[69,770,771],[101,770,771],[69,803,770],[101,803,770],[73,777],[105,777],[73,803],[105,803],[79,803],[111,803],[79,777],[111,777],[79,770,769],[111,770,769],[79,770,768],[111,770,768],[79,770,777],[111,770,777],[79,770,771],[111,770,771],[79,803,770],[111,803,770],[79,795,769],[111,795,769],[79,795,768],[111,795,768],[79,795,777],[111,795,777],[79,795,771],[111,795,771],[79,795,803],[111,795,803],[85,803],[117,803],[85,777],[117,777],[85,795,769],[117,795,769],[85,795,768],[117,795,768],[85,795,777],[117,795,777],[85,795,771],[117,795,771],[85,795,803],[117,795,803],[89,768],[121,768],[89,803],[121,803],[89,777],[121,777],[89,771],[121,771],];for(ix=0;ix<90;ix++){val=ls[ix];map[ix+7840]=val;}
ls=[[945,787],[945,788],[945,787,768],[945,788,768],[945,787,769],[945,788,769],[945,787,834],[945,788,834],[913,787],[913,788],[913,787,768],[913,788,768],[913,787,769],[913,788,769],[913,787,834],[913,788,834],[949,787],[949,788],[949,787,768],[949,788,768],[949,787,769],[949,788,769],];for(ix=0;ix<22;ix++){val=ls[ix];map[ix+7936]=val;}
ls=[[951,787],[951,788],[951,787,768],[951,788,768],[951,787,769],[951,788,769],[951,787,834],[951,788,834],[919,787],[919,788],[919,787,768],[919,788,768],[919,787,769],[919,788,769],[919,787,834],[919,788,834],[953,787],[953,788],[953,787,768],[953,788,768],[953,787,769],[953,788,769],[953,787,834],[953,788,834],[921,787],[921,788],[921,787,768],[921,788,768],[921,787,769],[921,788,769],[921,787,834],[921,788,834],[959,787],[959,788],[959,787,768],[959,788,768],[959,787,769],[959,788,769],];for(ix=0;ix<38;ix++){val=ls[ix];map[ix+7968]=val;}
ls=[[933,788,834],[969,787],[969,788],[969,787,768],[969,788,768],[969,787,769],[969,788,769],[969,787,834],[969,788,834],[937,787],[937,788],[937,787,768],[937,788,768],[937,787,769],[937,788,769],[937,787,834],[937,788,834],[945,768],[945,769],[949,768],[949,769],[951,768],[951,769],[953,768],[953,769],[959,768],[959,769],[965,768],[965,769],[969,768],[969,769],];for(ix=0;ix<31;ix++){val=ls[ix];map[ix+8031]=val;}
ls=[[945,787,837],[945,788,837],[945,787,768,837],[945,788,768,837],[945,787,769,837],[945,788,769,837],[945,787,834,837],[945,788,834,837],[913,787,837],[913,788,837],[913,787,768,837],[913,788,768,837],[913,787,769,837],[913,788,769,837],[913,787,834,837],[913,788,834,837],[951,787,837],[951,788,837],[951,787,768,837],[951,788,768,837],[951,787,769,837],[951,788,769,837],[951,787,834,837],[951,788,834,837],[919,787,837],[919,788,837],[919,787,768,837],[919,788,768,837],[919,787,769,837],[919,788,769,837],[919,787,834,837],[919,788,834,837],[969,787,837],[969,788,837],[969,787,768,837],[969,788,768,837],[969,787,769,837],[969,788,769,837],[969,787,834,837],[969,788,834,837],[937,787,837],[937,788,837],[937,787,768,837],[937,788,768,837],[937,787,769,837],[937,788,769,837],[937,787,834,837],[937,788,834,837],[945,774],[945,772],[945,768,837],[945,837],[945,769,837],];for(ix=0;ix<53;ix++){val=ls[ix];map[ix+8064]=val;}
ls=[[8190,768],[8190,769],[8190,834],[965,774],[965,772],[965,776,768],[965,776,769],[961,787],[961,788],[965,834],[965,776,834],[933,774],[933,772],[933,768],[933,769],[929,788],[168,768],[168,769],96,];for(ix=0;ix<19;ix++){val=ls[ix];map[ix+8157]=val;}
ls=[35912,26356,36554,36040,28369,20018,21477,40860,40860,22865,37329,21895,22856,25078,30313,32645,34367,34746,35064,37007,27138,27931,28889,29662,33853,37226,39409,20098,21365,27396,29211,34349,40478,23888,28651,34253,35172,25289,33240,34847,24266,26391,28010,29436,37070,20358,20919,21214,25796,27347,29200,30439,32769,34310,34396,36335,38706,39791,40442,30860,31103,32160,33737,37636,40575,35542,22751,24324,31840,32894,29282,30922,36034,38647,22744,23650,27155,28122,28431,32047,32311,38475,21202,32907,20956,20940,31260,32190,33777,38517,35712,25295,27138,35582,20025,23527,24594,29575,30064,21271,30971,20415,24489,19981,27852,25976,32034,21443,22622,30465,33865,35498,27578,36784,27784,25342,33509,25504,30053,20142,20841,20937,26753,31975,33391,35538,37327,21237,21570,22899,24300,26053,28670,31018,38317,39530,40599,40654,21147,26310,27511,36706,24180,24976,25088,25754,28451,29001,29833,31178,32244,32879,36646,34030,36899,37706,21015,21155,21693,28872,35010,35498,24265,24565,25467,27566,31806,29557,20196,22265,23527,23994,24604,29618,29801,32666,32838,37428,38646,38728,38936,20363,31150,37300,38584,24801,20102,20698,23534,23615,26009,27138,29134,30274,34044,36988,40845,26248,38446,21129,26491,26611,27969,28316,29705,30041,30827,32016,39006,20845,25134,38520,20523,23833,28138,36650,24459,24900,26647,29575,38534,21033,21519,23653,26131,26446,26792,27877,29702,30178,32633,35023,35041,37324,38626,21311,28346,21533,29136,29848,34298,38563,40023,40607,26519,28107,33256,31435,31520,31890,29376,28825,35672,20160,33590,21050,20999,24230,25299,31958,23429,27934,26292,36667,34892,38477,35211,24275,20800,21952,];for(ix=0;ix<270;ix++){val=ls[ix];map[ix+63744]=val;}
ls=[20398,20711,20813,21193,21220,21329,21917,22022,22120,22592,22696,23652,23662,24724,24936,24974,25074,25935,26082,26257,26757,28023,28186,28450,29038,29227,29730,30865,31038,31049,31048,31056,31062,31069,31117,31118,31296,31361,31680,32244,32265,32321,32626,32773,33261,33401,33401,33879,35088,35222,35585,35641,36051,36104,36790,36920,38627,38911,38971,];for(ix=0;ix<59;ix++){val=ls[ix];map[ix+64048]=val;}
ls=[20029,20024,20033,131362,20320,20398,20411,20482,20602,20633,20711,20687,13470,132666,20813,20820,20836,20855,132380,13497,20839,20877,132427,20887,20900,20172,20908,20917,168415,20981,20995,13535,21051,21062,21106,21111,13589,21191,21193,21220,21242,21253,21254,21271,21321,21329,21338,21363,21373,21375,21375,21375,133676,28784,21450,21471,133987,21483,21489,21510,21662,21560,21576,21608,21666,21750,21776,21843,21859,21892,21892,21913,21931,21939,21954,22294,22022,22295,22097,22132,20999,22766,22478,22516,22541,22411,22578,22577,22700,136420,22770,22775,22790,22810,22818,22882,136872,136938,23020,23067,23079,23000,23142,14062,14076,23304,23358,23358,137672,23491,23512,23527,23539,138008,23551,23558,24403,23586,14209,23648,23662,23744,23693,138724,23875,138726,23918,23915,23932,24033,24034,14383,24061,24104,24125,24169,14434,139651,14460,24240,24243,24246,24266,172946,24318,140081,140081,33281,24354,24354,14535,144056,156122,24418,24427,14563,24474,24525,24535,24569,24705,14650,14620,24724,141012,24775,24904,24908,24910,24908,24954,24974,25010,24996,25007,25054,25074,25078,25104,25115,25181,25265,25300,25424,142092,25405,25340,25448,25475,25572,142321,25634,25541,25513,14894,25705,25726,25757,25719,14956,25935,25964,143370,26083,26360,26185,15129,26257,15112,15076,20882,20885,26368,26268,32941,17369,26391,26395,26401,26462,26451,144323,15177,26618,26501,26706,26757,144493,26766,26655,26900,15261,26946,27043,27114,27304,145059,27355,15384,27425,145575,27476,15438,27506,27551,27578,27579,146061,138507,146170,27726,146620,27839,27853,27751,27926,27966,28023,27969,28009,28024,28037,146718,27956,28207,28270,15667,28363,28359,147153,28153,28526,147294,147342,28614,28729,28702,28699,15766,28746,28797,28791,28845,132389,28997,148067,29084,148395,29224,29237,29264,149000,29312,29333,149301,149524,29562,29579,16044,29605,16056,16056,29767,29788,29809,29829,29898,16155,29988,150582,30014,150674,30064,139679,30224,151457,151480,151620,16380,16392,30452,151795,151794,151833,151859,30494,30495,30495,30538,16441,30603,16454,16534,152605,30798,30860,30924,16611,153126,31062,153242,153285,31119,31211,16687,31296,31306,31311,153980,154279,154279,31470,16898,154539,31686,31689,16935,154752,31954,17056,31976,31971,32000,155526,32099,17153,32199,32258,32325,17204,156200,156231,17241,156377,32634,156478,32661,32762,32773,156890,156963,32864,157096,32880,144223,17365,32946,33027,17419,33086,23221,157607,157621,144275,144284,33281,33284,36766,17515,33425,33419,33437,21171,33457,33459,33469,33510,158524,33509,33565,33635,33709,33571,33725,33767,33879,33619,33738,33740,33756,158774,159083,158933,17707,34033,34035,34070,160714,34148,159532,17757,17761,159665,159954,17771,34384,34396,34407,34409,34473,34440,34574,34530,34681,34600,34667,34694,17879,34785,34817,17913,34912,34915,161383,35031,35038,17973,35066,13499,161966,162150,18110,18119,35488,35565,35722,35925,162984,36011,36033,36123,36215,163631,133124,36299,36284,36336,133342,36564,36664,165330,165357,37012,37105,37137,165678,37147,37432,37591,37592,37500,37881,37909,166906,38283,18837,38327,167287,18918,38595,23986,38691,168261,168474,19054,19062,38880,168970,19122,169110,38923,38923,38953,169398,39138,19251,39209,39335,39362,39422,19406,170800,39698,40000,40189,19662,19693,40295,172238,19704,172293,172558,172689,40635,19798,40697,40702,40709,40719,40726,40763,173568,];for(ix=0;ix<542;ix++){val=ls[ix];map[ix+194560]=val;}})();var unicode_combin_table={768:230,769:230,770:230,771:230,772:230,773:230,774:230,775:230,776:230,777:230,778:230,779:230,780:230,781:230,782:230,783:230,784:230,785:230,786:230,787:230,788:230,789:232,790:220,791:220,792:220,793:220,794:232,795:216,796:220,797:220,798:220,799:220,800:220,801:202,802:202,803:220,804:220,805:220,806:220,807:202,808:202,809:220,810:220,811:220,812:220,813:220,814:220,815:220,816:220,817:220,818:220,819:220,820:1,821:1,822:1,823:1,824:1,825:220,826:220,827:220,828:220,829:230,830:230,831:230,832:230,833:230,834:230,835:230,836:230,837:240,838:230,839:220,840:220,841:220,842:230,843:230,844:230,845:220,846:220,848:230,849:230,850:230,851:220,852:220,853:220,854:220,855:230,861:234,862:234,863:233,864:234,865:234,866:233,867:230,868:230,869:230,870:230,871:230,872:230,873:230,874:230,875:230,876:230,877:230,878:230,879:230,1155:230,1156:230,1157:230,1158:230,1425:220,1426:230,1427:230,1428:230,1429:230,1430:220,1431:230,1432:230,1433:230,1434:222,1435:220,1436:230,1437:230,1438:230,1439:230,1440:230,1441:230,1443:220,1444:220,1445:220,1446:220,1447:220,1448:230,1449:230,1450:220,1451:230,1452:230,1453:222,1454:228,1455:230,1456:10,1457:11,1458:12,1459:13,1460:14,1461:15,1462:16,1463:17,1464:18,1465:19,1467:20,1468:21,1469:22,1471:23,1473:24,1474:25,1476:230,1552:230,1553:230,1554:230,1555:230,1556:230,1557:230,1611:27,1612:28,1613:29,1614:30,1615:31,1616:32,1617:33,1618:34,1619:230,1620:230,1621:220,1622:220,1623:230,1624:230,1648:35,1750:230,1751:230,1752:230,1753:230,1754:230,1755:230,1756:230,1759:230,1760:230,1761:230,1762:230,1763:220,1764:230,1767:230,1768:230,1770:220,1771:230,1772:230,1773:220,1809:36,1840:230,1841:220,1842:230,1843:230,1844:220,1845:230,1846:230,1847:220,1848:220,1849:220,1850:230,1851:220,1852:220,1853:230,1854:220,1855:230,1856:230,1857:230,1858:220,1859:230,1860:220,1861:230,1862:220,1863:230,1864:220,1865:230,1866:230,2364:7,2381:9,2385:230,2386:220,2387:230,2388:230,2492:7,2509:9,2620:7,2637:9,2748:7,2765:9,2876:7,2893:9,3021:9,3149:9,3157:84,3158:91,3260:7,3277:9,3405:9,3530:9,3640:103,3641:103,3642:9,3656:107,3657:107,3658:107,3659:107,3768:118,3769:118,3784:122,3785:122,3786:122,3787:122,3864:220,3865:220,3893:220,3895:220,3897:216,3953:129,3954:130,3956:132,3962:130,3963:130,3964:130,3965:130,3968:130,3970:230,3971:230,3972:9,3974:230,3975:230,4038:220,4151:7,4153:9,5908:9,5940:9,6098:9,6109:230,6313:228,6457:222,6458:230,6459:220,8400:230,8401:230,8402:1,8403:1,8404:230,8405:230,8406:230,8407:230,8408:1,8409:1,8410:1,8411:230,8412:230,8417:230,8421:1,8422:1,8423:230,8424:220,8425:230,8426:1,12330:218,12331:228,12332:232,12333:222,12334:224,12335:224,12441:8,12442:8,64286:26,65056:230,65057:230,65058:230,65059:230,119141:216,119142:216,119143:1,119144:1,119145:1,119149:226,119150:216,119151:216,119152:216,119153:216,119154:216,119163:220,119164:220,119165:220,119166:220,119167:220,119168:220,119169:220,119170:220,119173:230,119174:230,119175:230,119176:230,119177:230,119178:220,119179:220,119210:230,119211:230,119212:230,119213:230};var unicode_compo_table={60:{824:8814},61:{824:8800},62:{824:8815},65:{768:192,769:193,770:194,771:195,772:256,774:258,775:550,776:196,777:7842,778:197,780:461,783:512,785:514,803:7840,805:7680,808:260},66:{775:7682,803:7684,817:7686},67:{769:262,770:264,775:266,780:268,807:199},68:{775:7690,780:270,803:7692,807:7696,813:7698,817:7694},69:{768:200,769:201,770:202,771:7868,772:274,774:276,775:278,776:203,777:7866,780:282,783:516,785:518,803:7864,807:552,808:280,813:7704,816:7706},70:{775:7710},71:{769:500,770:284,772:7712,774:286,775:288,780:486,807:290},72:{770:292,775:7714,776:7718,780:542,803:7716,807:7720,814:7722},73:{768:204,769:205,770:206,771:296,772:298,774:300,775:304,776:207,777:7880,780:463,783:520,785:522,803:7882,808:302,816:7724},74:{770:308},75:{769:7728,780:488,803:7730,807:310,817:7732},76:{769:313,780:317,803:7734,807:315,813:7740,817:7738},77:{769:7742,775:7744,803:7746},78:{768:504,769:323,771:209,775:7748,780:327,803:7750,807:325,813:7754,817:7752},79:{768:210,769:211,770:212,771:213,772:332,774:334,775:558,776:214,777:7886,779:336,780:465,783:524,785:526,795:416,803:7884,808:490},80:{769:7764,775:7766},82:{769:340,775:7768,780:344,783:528,785:530,803:7770,807:342,817:7774},83:{769:346,770:348,775:7776,780:352,803:7778,806:536,807:350},84:{775:7786,780:356,803:7788,806:538,807:354,813:7792,817:7790},85:{768:217,769:218,770:219,771:360,772:362,774:364,776:220,777:7910,778:366,779:368,780:467,783:532,785:534,795:431,803:7908,804:7794,808:370,813:7798,816:7796},86:{771:7804,803:7806},87:{768:7808,769:7810,770:372,775:7814,776:7812,803:7816},88:{775:7818,776:7820},89:{768:7922,769:221,770:374,771:7928,772:562,775:7822,776:376,777:7926,803:7924},90:{769:377,770:7824,775:379,780:381,803:7826,817:7828},97:{768:224,769:225,770:226,771:227,772:257,774:259,775:551,776:228,777:7843,778:229,780:462,783:513,785:515,803:7841,805:7681,808:261},98:{775:7683,803:7685,817:7687},99:{769:263,770:265,775:267,780:269,807:231},100:{775:7691,780:271,803:7693,807:7697,813:7699,817:7695},101:{768:232,769:233,770:234,771:7869,772:275,774:277,775:279,776:235,777:7867,780:283,783:517,785:519,803:7865,807:553,808:281,813:7705,816:7707},102:{775:7711},103:{769:501,770:285,772:7713,774:287,775:289,780:487,807:291},104:{770:293,775:7715,776:7719,780:543,803:7717,807:7721,814:7723,817:7830},105:{768:236,769:237,770:238,771:297,772:299,774:301,776:239,777:7881,780:464,783:521,785:523,803:7883,808:303,816:7725},106:{770:309,780:496},107:{769:7729,780:489,803:7731,807:311,817:7733},108:{769:314,780:318,803:7735,807:316,813:7741,817:7739},109:{769:7743,775:7745,803:7747},110:{768:505,769:324,771:241,775:7749,780:328,803:7751,807:326,813:7755,817:7753},111:{768:242,769:243,770:244,771:245,772:333,774:335,775:559,776:246,777:7887,779:337,780:466,783:525,785:527,795:417,803:7885,808:491},112:{769:7765,775:7767},114:{769:341,775:7769,780:345,783:529,785:531,803:7771,807:343,817:7775},115:{769:347,770:349,775:7777,780:353,803:7779,806:537,807:351},116:{775:7787,776:7831,780:357,803:7789,806:539,807:355,813:7793,817:7791},117:{768:249,769:250,770:251,771:361,772:363,774:365,776:252,777:7911,778:367,779:369,780:468,783:533,785:535,795:432,803:7909,804:7795,808:371,813:7799,816:7797},118:{771:7805,803:7807},119:{768:7809,769:7811,770:373,775:7815,776:7813,778:7832,803:7817},120:{775:7819,776:7821},121:{768:7923,769:253,770:375,771:7929,772:563,775:7823,776:255,777:7927,778:7833,803:7925},122:{769:378,770:7825,775:380,780:382,803:7827,817:7829},168:{768:8173,769:901,834:8129},194:{768:7846,769:7844,771:7850,777:7848},196:{772:478},197:{769:506},198:{769:508,772:482},199:{769:7688},202:{768:7872,769:7870,771:7876,777:7874},207:{769:7726},212:{768:7890,769:7888,771:7894,777:7892},213:{769:7756,772:556,776:7758},214:{772:554},216:{769:510},220:{768:475,769:471,772:469,780:473},226:{768:7847,769:7845,771:7851,777:7849},228:{772:479},229:{769:507},230:{769:509,772:483},231:{769:7689},234:{768:7873,769:7871,771:7877,777:7875},239:{769:7727},244:{768:7891,769:7889,771:7895,777:7893},245:{769:7757,772:557,776:7759},246:{772:555},248:{769:511},252:{768:476,769:472,772:470,780:474},258:{768:7856,769:7854,771:7860,777:7858},259:{768:7857,769:7855,771:7861,777:7859},274:{768:7700,769:7702},275:{768:7701,769:7703},332:{768:7760,769:7762},333:{768:7761,769:7763},346:{775:7780},347:{775:7781},352:{775:7782},353:{775:7783},360:{769:7800},361:{769:7801},362:{776:7802},363:{776:7803},383:{775:7835},416:{768:7900,769:7898,771:7904,777:7902,803:7906},417:{768:7901,769:7899,771:7905,777:7903,803:7907},431:{768:7914,769:7912,771:7918,777:7916,803:7920},432:{768:7915,769:7913,771:7919,777:7917,803:7921},439:{780:494},490:{772:492},491:{772:493},550:{772:480},551:{772:481},552:{774:7708},553:{774:7709},558:{772:560},559:{772:561},658:{780:495},776:{769:836},913:{768:8122,769:902,772:8121,774:8120,787:7944,788:7945,837:8124},917:{768:8136,769:904,787:7960,788:7961},919:{768:8138,769:905,787:7976,788:7977,837:8140},921:{768:8154,769:906,772:8153,774:8152,776:938,787:7992,788:7993},927:{768:8184,769:908,787:8008,788:8009},929:{788:8172},933:{768:8170,769:910,772:8169,774:8168,776:939,788:8025},937:{768:8186,769:911,787:8040,788:8041,837:8188},940:{837:8116},942:{837:8132},945:{768:8048,769:940,772:8113,774:8112,787:7936,788:7937,834:8118,837:8115},949:{768:8050,769:941,787:7952,788:7953},951:{768:8052,769:942,787:7968,788:7969,834:8134,837:8131},953:{768:8054,769:943,772:8145,774:8144,776:970,787:7984,788:7985,834:8150},959:{768:8056,769:972,787:8000,788:8001},961:{787:8164,788:8165},965:{768:8058,769:973,772:8161,774:8160,776:971,787:8016,788:8017,834:8166},969:{768:8060,769:974,787:8032,788:8033,834:8182,837:8179},970:{768:8146,769:912,834:8151},971:{768:8162,769:944,834:8167},974:{837:8180},978:{769:979,776:980},1030:{776:1031},1040:{774:1232,776:1234},1043:{769:1027},1045:{768:1024,774:1238,776:1025},1046:{774:1217,776:1244},1047:{776:1246},1048:{768:1037,772:1250,774:1049,776:1252},1050:{769:1036},1054:{776:1254},1059:{772:1262,774:1038,776:1264,779:1266},1063:{776:1268},1067:{776:1272},1069:{776:1260},1072:{774:1233,776:1235},1075:{769:1107},1077:{768:1104,774:1239,776:1105},1078:{774:1218,776:1245},1079:{776:1247},1080:{768:1117,772:1251,774:1081,776:1253},1082:{769:1116},1086:{776:1255},1091:{772:1263,774:1118,776:1265,779:1267},1095:{776:1269},1099:{776:1273},1101:{776:1261},1110:{776:1111},1140:{783:1142},1141:{783:1143},1240:{776:1242},1241:{776:1243},1256:{776:1258},1257:{776:1259},1488:{1463:64302,1464:64303,1468:64304},1489:{1468:64305,1471:64332},1490:{1468:64306},1491:{1468:64307},1492:{1468:64308},1493:{1465:64331,1468:64309},1494:{1468:64310},1496:{1468:64312},1497:{1460:64285,1468:64313},1498:{1468:64314},1499:{1468:64315,1471:64333},1500:{1468:64316},1502:{1468:64318},1504:{1468:64320},1505:{1468:64321},1507:{1468:64323},1508:{1468:64324,1471:64334},1510:{1468:64326},1511:{1468:64327},1512:{1468:64328},1513:{1468:64329,1473:64298,1474:64299},1514:{1468:64330},1522:{1463:64287},1575:{1619:1570,1620:1571,1621:1573},1608:{1620:1572},1610:{1620:1574},1729:{1620:1730},1746:{1620:1747},1749:{1620:1728},2325:{2364:2392},2326:{2364:2393},2327:{2364:2394},2332:{2364:2395},2337:{2364:2396},2338:{2364:2397},2344:{2364:2345},2347:{2364:2398},2351:{2364:2399},2352:{2364:2353},2355:{2364:2356},2465:{2492:2524},2466:{2492:2525},2479:{2492:2527},2503:{2494:2507,2519:2508},2582:{2620:2649},2583:{2620:2650},2588:{2620:2651},2603:{2620:2654},2610:{2620:2611},2616:{2620:2614},2849:{2876:2908},2850:{2876:2909},2887:{2878:2891,2902:2888,2903:2892},2962:{3031:2964},3014:{3006:3018,3031:3020},3015:{3006:3019},3142:{3158:3144},3263:{3285:3264},3270:{3266:3274,3285:3271,3286:3272},3274:{3285:3275},3398:{3390:3402,3415:3404},3399:{3390:3403},3545:{3530:3546,3535:3548,3551:3550},3548:{3530:3549},3904:{4021:3945},3906:{4023:3907},3916:{4023:3917},3921:{4023:3922},3926:{4023:3927},3931:{4023:3932},3953:{3954:3955,3956:3957,3968:3969},3984:{4021:4025},3986:{4023:3987},3996:{4023:3997},4001:{4023:4002},4006:{4023:4007},4011:{4023:4012},4018:{3968:3958},4019:{3968:3960},4133:{4142:4134},7734:{772:7736},7735:{772:7737},7770:{772:7772},7771:{772:7773},7778:{775:7784},7779:{775:7785},7840:{770:7852,774:7862},7841:{770:7853,774:7863},7864:{770:7878},7865:{770:7879},7884:{770:7896},7885:{770:7897},7936:{768:7938,769:7940,834:7942,837:8064},7937:{768:7939,769:7941,834:7943,837:8065},7938:{837:8066},7939:{837:8067},7940:{837:8068},7941:{837:8069},7942:{837:8070},7943:{837:8071},7944:{768:7946,769:7948,834:7950,837:8072},7945:{768:7947,769:7949,834:7951,837:8073},7946:{837:8074},7947:{837:8075},7948:{837:8076},7949:{837:8077},7950:{837:8078},7951:{837:8079},7952:{768:7954,769:7956},7953:{768:7955,769:7957},7960:{768:7962,769:7964},7961:{768:7963,769:7965},7968:{768:7970,769:7972,834:7974,837:8080},7969:{768:7971,769:7973,834:7975,837:8081},7970:{837:8082},7971:{837:8083},7972:{837:8084},7973:{837:8085},7974:{837:8086},7975:{837:8087},7976:{768:7978,769:7980,834:7982,837:8088},7977:{768:7979,769:7981,834:7983,837:8089},7978:{837:8090},7979:{837:8091},7980:{837:8092},7981:{837:8093},7982:{837:8094},7983:{837:8095},7984:{768:7986,769:7988,834:7990},7985:{768:7987,769:7989,834:7991},7992:{768:7994,769:7996,834:7998},7993:{768:7995,769:7997,834:7999},8000:{768:8002,769:8004},8001:{768:8003,769:8005},8008:{768:8010,769:8012},8009:{768:8011,769:8013},8016:{768:8018,769:8020,834:8022},8017:{768:8019,769:8021,834:8023},8025:{768:8027,769:8029,834:8031},8032:{768:8034,769:8036,834:8038,837:8096},8033:{768:8035,769:8037,834:8039,837:8097},8034:{837:8098},8035:{837:8099},8036:{837:8100},8037:{837:8101},8038:{837:8102},8039:{837:8103},8040:{768:8042,769:8044,834:8046,837:8104},8041:{768:8043,769:8045,834:8047,837:8105},8042:{837:8106},8043:{837:8107},8044:{837:8108},8045:{837:8109},8046:{837:8110},8047:{837:8111},8048:{837:8114},8052:{837:8130},8060:{837:8178},8118:{837:8119},8127:{768:8141,769:8142,834:8143},8134:{837:8135},8182:{837:8183},8190:{768:8157,769:8158,834:8159},8592:{824:8602},8594:{824:8603},8596:{824:8622},8656:{824:8653},8658:{824:8655},8660:{824:8654},8707:{824:8708},8712:{824:8713},8715:{824:8716},8739:{824:8740},8741:{824:8742},8764:{824:8769},8771:{824:8772},8773:{824:8775},8776:{824:8777},8781:{824:8813},8801:{824:8802},8804:{824:8816},8805:{824:8817},8818:{824:8820},8819:{824:8821},8822:{824:8824},8823:{824:8825},8826:{824:8832},8827:{824:8833},8828:{824:8928},8829:{824:8929},8834:{824:8836},8835:{824:8837},8838:{824:8840},8839:{824:8841},8849:{824:8930},8850:{824:8931},8866:{824:8876},8872:{824:8877},8873:{824:8878},8875:{824:8879},8882:{824:8938},8883:{824:8939},8884:{824:8940},8885:{824:8941},10973:{824:10972},12358:{12441:12436},12363:{12441:12364},12365:{12441:12366},12367:{12441:12368},12369:{12441:12370},12371:{12441:12372},12373:{12441:12374},12375:{12441:12376},12377:{12441:12378},12379:{12441:12380},12381:{12441:12382},12383:{12441:12384},12385:{12441:12386},12388:{12441:12389},12390:{12441:12391},12392:{12441:12393},12399:{12441:12400,12442:12401},12402:{12441:12403,12442:12404},12405:{12441:12406,12442:12407},12408:{12441:12409,12442:12410},12411:{12441:12412,12442:12413},12445:{12441:12446},12454:{12441:12532},12459:{12441:12460},12461:{12441:12462},12463:{12441:12464},12465:{12441:12466},12467:{12441:12468},12469:{12441:12470},12471:{12441:12472},12473:{12441:12474},12475:{12441:12476},12477:{12441:12478},12479:{12441:12480},12481:{12441:12482},12484:{12441:12485},12486:{12441:12487},12488:{12441:12489},12495:{12441:12496,12442:12497},12498:{12441:12499,12442:12500},12501:{12441:12502,12442:12503},12504:{12441:12505,12442:12506},12507:{12441:12508,12442:12509},12527:{12441:12535},12528:{12441:12536},12529:{12441:12537},12530:{12441:12538},12541:{12441:12542},64329:{1473:64300,1474:64301},119127:{119141:119134},119128:{119141:119135},119135:{119150:119136,119151:119137,119152:119138,119153:119139,119154:119140},119225:{119141:119227},119226:{119141:119228},119227:{119150:119229,119151:119231},119228:{119150:119230,119151:119232}};function CharToString(val){if(val<0x10000){return String.fromCharCode(val);}
else{val-=0x10000;return String.fromCharCode(0xD800+(val>>10),0xDC00+(val&0x3FF));}}
function TrimArrayToBytes(arr){var ix,newarr;var len=arr.length;for(ix=0;ix<len;ix++){if(arr[ix]<0||arr[ix]>=0x100)
break;}
if(ix==len){return arr;}
newarr=Array(len);for(ix=0;ix<len;ix++){if(arr[ix]<0||arr[ix]>=0x100)
newarr[ix]=63;else
newarr[ix]=arr[ix];}
return newarr;}
function ByteArrayToString(arr){var ix,newarr;var len=arr.length;if(len==0)
return'';for(ix=0;ix<len;ix++){if(arr[ix]<0||arr[ix]>=0x100)
break;}
if(ix==len){return String.fromCharCode.apply(this,arr);}
newarr=Array(len);for(ix=0;ix<len;ix++){newarr[ix]=String.fromCharCode(arr[ix]&0xFF);}
return newarr.join('');}
function UniArrayToString(arr){var ix,val,newarr;var len=arr.length;if(len==0)
return'';for(ix=0;ix<len;ix++){if(arr[ix]>=0x10000)
break;}
if(ix==len){return String.fromCharCode.apply(this,arr);}
newarr=Array(len);for(ix=0;ix<len;ix++){val=arr[ix];if(val<0x10000){newarr[ix]=String.fromCharCode(val);}
else{val-=0x10000;newarr[ix]=String.fromCharCode(0xD800+(val>>10),0xDC00+(val&0x3FF));}}
return newarr.join('');}
function UniArrayToUTF8(arr){var count=0;for(var ix=0;ix<arr.length;ix++){var val=arr[ix];if(val<0x80){count+=1;}
else if(val<0x800){count+=2;}
else if(val<0x10000){count+=3;}
else if(val<0x200000){count+=4;}
else{count+=1;}}
if(count==arr.length)
return arr;var res=[];for(var ix=0;ix<arr.length;ix++){var val=arr[ix];if(val<0x80){res.push(val);}
else if(val<0x800){res.push(0xC0|((val&0x7C0)>>6));res.push(0x80|(val&0x03F));}
else if(val<0x10000){res.push(0xE0|((val&0xF000)>>12));res.push(0x80|((val&0x0FC0)>>6));res.push(0x80|(val&0x003F));}
else if(val<0x200000){res.push(0xF0|((val&0x1C0000)>>18));res.push(0x80|((val&0x03F000)>>12));res.push(0x80|((val&0x000FC0)>>6));res.push(0x80|(val&0x00003F));}
else{res.push(63);}}
return res;}
function UniArrayToBE32(arr){var res=new Array(4*arr.length);for(var ix=0;ix<arr.length;ix++){var val=arr[ix];res[4*ix]=(val>>24)&0xFF;res[4*ix+1]=(val>>16)&0xFF;res[4*ix+2]=(val>>8)&0xFF;res[4*ix+3]=(val)&0xFF;}
return res;}
function qlog(msg){if(window.console&&console.log)
console.log(msg);else if(window.opera&&opera.postError)
opera.postError(msg);}
function RefBox(){this.value=undefined;this.set_value=function(val){this.value=val;}
this.get_value=function(){return this.value;}}
function RefStruct(numels){this.fields=[];this.push_field=function(val){this.fields.push(val);}
this.set_field=function(pos,val){this.fields[pos]=val;}
this.get_field=function(pos){return this.fields[pos];}
this.get_fields=function(){return this.fields;}}
var DidNotReturn={dummy:'Glk call has not yet returned'};function call_may_not_return(id){if(id==0x001||id==0x0C0||id==0x062)
return true;else
return false;}
var strtype_File=1;var strtype_Window=2;var strtype_Memory=3;var strtype_Resource=4;var gli_autorestore_glkstate=null;var gli_windowlist=null;var gli_rootwin=null;var geometry_changed=true;var content_metrics=null;var gli_streamlist=null;var gli_filereflist=null;var gli_schannellist=null;var gli_currentstr=null;var gli_selectref=null;var gli_api_display_rocks=1;var gli_timer_interval=null;var gli_timer_started=null;var gli_timer_lastsent=null;function gli_new_window(type,rock){var win={};win.type=type;win.rock=rock;win.disprock=undefined;win.parent=null;win.str=gli_stream_open_window(win);win.echostr=null;win.style=Const.style_Normal;win.hyperlink=0;win.input_generation=null;win.linebuf=null;win.char_request=false;win.line_request=false;win.char_request_uni=false;win.line_request_uni=false;win.hyperlink_request=false;win.mouse_request=false;win.echo_line_input=true;win.line_input_terminators=[];win.request_echo_line_input=null;win.prev=null;win.next=gli_windowlist;gli_windowlist=win;if(win.next)
win.next.prev=win;if(GiDispa)
GiDispa.class_register('window',win);else
win.disprock=gli_api_display_rocks++;geometry_changed=true;return win;}
function gli_delete_window(win){var prev,next;if(GiDispa)
GiDispa.class_unregister('window',win);geometry_changed=true;win.echostr=null;if(win.str){gli_delete_stream(win.str);win.str=null;}
prev=win.prev;next=win.next;win.prev=null;win.next=null;if(prev)
prev.next=next;else
gli_windowlist=next;if(next)
next.prev=prev;win.parent=null;win.rock=null;win.disprock=null;}
function gli_windows_unechostream(str){var win;for(win=gli_windowlist;win;win=win.next){if(win.echostr===str)
win.echostr=null;}}
function gli_window_put_string(win,val){var ix,ch;switch(win.type){case Const.wintype_TextBuffer:if(win.style!=win.accumstyle||win.hyperlink!=win.accumhyperlink)
gli_window_buffer_deaccumulate(win);win.accum.push(val);break;case Const.wintype_TextGrid:for(ix=0;ix<val.length;ix++){ch=val.charAt(ix);if(win.cursorx<0)
win.cursorx=0;if(win.cursorx>=win.gridwidth){win.cursorx=0;win.cursory++;}
if(win.cursory<0)
win.cursory=0;if(win.cursory>=win.gridheight)
break;if(ch=="\n"){win.cursory++;win.cursorx=0;continue;}
var lineobj=win.lines[win.cursory];lineobj.dirty=true;lineobj.chars[win.cursorx]=ch;lineobj.styles[win.cursorx]=win.style;lineobj.hyperlinks[win.cursorx]=win.hyperlink;win.cursorx++;}
break;}}
function gli_window_grid_canonicalize(win){if(win.cursorx<0)
win.cursorx=0;if(win.cursorx>=win.gridwidth){win.cursorx=0;win.cursory++;}
if(win.cursory<0)
win.cursory=0;if(win.cursory>=win.gridheight)
return true;return false;}
function gli_window_buffer_deaccumulate(win){var conta=win.content;var stylename=StyleNameMap[win.accumstyle];var text,ls,ix,obj,arr;if(win.accum.length){text=win.accum.join('');ls=text.split('\n');for(ix=0;ix<ls.length;ix++){arr=undefined;if(ix==0){if(ls[ix]){if(conta.length==0){arr=[];conta.push({content:arr,append:true});}
else{obj=conta[conta.length-1];if(!obj.content){arr=[];obj.content=arr;}
else{arr=obj.content;}}}}
else{if(ls[ix]){arr=[];conta.push({content:arr});}
else{conta.push({});}}
if(arr!==undefined){if(!win.accumhyperlink){arr.push(stylename);arr.push(ls[ix]);}
else{arr.push({style:stylename,text:ls[ix],hyperlink:win.accumhyperlink});}}}}
win.accum.length=0;win.accumstyle=win.style;win.accumhyperlink=win.hyperlink;}
function gli_window_buffer_put_special(win,special,flowbreak){gli_window_buffer_deaccumulate(win);var conta=win.content;var arr=undefined;var obj;if(conta.length==0){arr=[];obj={content:arr,append:true};if(flowbreak)
obj.flowbreak=true;conta.push(obj);}
else{obj=conta[conta.length-1];if(flowbreak)
obj.flowbreak=true;if(!obj.content){arr=[];obj.content=arr;}
else{arr=obj.content;}}
if(arr!==undefined&&special!==undefined){arr.push(special);}}
function gli_window_close(win,recurse){var wx;for(wx=win.parent;wx;wx=wx.parent){if(wx.type==Const.wintype_Pair){if(wx.pair_key===win){wx.pair_key=null;wx.pair_keydamage=true;}}}
if(GiDispa&&win.linebuf){GiDispa.unretain_array(win.linebuf);win.linebuf=null;}
switch(win.type){case Const.wintype_Pair:if(recurse){if(win.child1)
gli_window_close(win.child1,true);if(win.child2)
gli_window_close(win.child2,true);}
win.child1=null;win.child2=null;win.pair_key=null;break;case Const.wintype_TextBuffer:win.accum=null;win.content=null;win.reserve=null;break;case Const.wintype_TextGrid:win.lines=null;break;case Const.wintype_Graphics:win.content=null;win.reserve=null;break;}
gli_delete_window(win);}
function gli_window_rearrange(win,box){var width,height,oldwidth,oldheight;var min,max,diff,split,splitwid,ix,cx,lineobj;var box1,box2,ch1,ch2;geometry_changed=true;win.bbox=box;switch(win.type){case Const.wintype_TextGrid:width=box.right-box.left;height=box.bottom-box.top;oldheight=win.gridheight;win.gridwidth=Math.max(0,Math.floor((width-content_metrics.gridmarginx)/content_metrics.gridcharwidth));win.gridheight=Math.max(0,Math.floor((height-content_metrics.gridmarginy)/content_metrics.gridcharheight));if(oldheight>win.gridheight){win.lines.length=win.gridheight;}
else if(oldheight<win.gridheight){for(ix=oldheight;ix<win.gridheight;ix++){win.lines[ix]={chars:[],styles:[],hyperlinks:[],dirty:true};}}
for(ix=0;ix<win.gridheight;ix++){lineobj=win.lines[ix];oldwidth=lineobj.chars.length;if(oldwidth>win.gridwidth){lineobj.dirty=true;lineobj.chars.length=win.gridwidth;lineobj.styles.length=win.gridwidth;lineobj.hyperlinks.length=win.gridwidth;}
else if(oldwidth<win.gridwidth){lineobj.dirty=true;for(cx=oldwidth;cx<win.gridwidth;cx++){lineobj.chars[cx]=' ';lineobj.styles[cx]=Const.style_Normal;lineobj.hyperlinks[cx]=0;}}}
break;case Const.wintype_Graphics:width=box.right-box.left;height=box.bottom-box.top;win.graphwidth=Math.max(0,width-content_metrics.graphicsmarginx);win.graphheight=Math.max(0,height-content_metrics.graphicsmarginy);break;case Const.wintype_Pair:if(win.pair_vertical){min=win.bbox.left;max=win.bbox.right;splitwid=content_metrics.inspacingx;}
else{min=win.bbox.top;max=win.bbox.bottom;splitwid=content_metrics.inspacingy;}
if(!win.pair_hasborder)
splitwid=0;diff=max-min;if(win.pair_division==Const.winmethod_Proportional){split=Math.floor((diff*win.pair_size)/100);}
else if(win.pair_division==Const.winmethod_Fixed){split=0;if(win.pair_key&&win.pair_key.type==Const.wintype_TextBuffer){if(!win.pair_vertical)
split=(win.pair_size*content_metrics.buffercharheight+content_metrics.buffermarginy);else
split=(win.pair_size*content_metrics.buffercharwidth+content_metrics.buffermarginx);}
if(win.pair_key&&win.pair_key.type==Const.wintype_TextGrid){if(!win.pair_vertical)
split=(win.pair_size*content_metrics.gridcharheight+content_metrics.gridmarginy);else
split=(win.pair_size*content_metrics.gridcharwidth+content_metrics.gridmarginx);}
if(win.pair_key&&win.pair_key.type==Const.wintype_Graphics){if(!win.pair_vertical)
split=win.pair_size+content_metrics.graphicsmarginy;else
split=win.pair_size+content_metrics.graphicsmarginx;}
split=Math.ceil(split);}
else{split=Math.floor(diff/2);}
if(!win.pair_backward){split=max-split-splitwid;}
else{split=min+split;}
if(min>=max){split=min;}
else{split=Math.min(Math.max(split,min),max-splitwid);}
win.pair_splitpos=split;win.pair_splitwidth=splitwid;if(win.pair_vertical){box1={left:win.bbox.left,right:win.pair_splitpos,top:win.bbox.top,bottom:win.bbox.bottom};box2={left:box1.right+win.pair_splitwidth,right:win.bbox.right,top:win.bbox.top,bottom:win.bbox.bottom};}
else{box1={top:win.bbox.top,bottom:win.pair_splitpos,left:win.bbox.left,right:win.bbox.right};box2={top:box1.bottom+win.pair_splitwidth,bottom:win.bbox.bottom,left:win.bbox.left,right:win.bbox.right};}
if(!win.pair_backward){ch1=win.child1;ch2=win.child2;}
else{ch1=win.child2;ch2=win.child1;}
gli_window_rearrange(ch1,box1);gli_window_rearrange(ch2,box2);break;}}
function gli_new_stream(type,readable,writable,rock){var str={};str.type=type;str.rock=rock;str.disprock=undefined;str.unicode=false;str.isbinary=false;str.streaming=false;str.ref=null;str.win=null;str.file=null;str.buf=null;str.bufpos=0;str.buflen=0;str.bufeof=0;str.timer_id=null;str.flush_func=null;str.fstream=null;str.readcount=0;str.writecount=0;str.readable=readable;str.writable=writable;str.prev=null;str.next=gli_streamlist;gli_streamlist=str;if(str.next)
str.next.prev=str;if(GiDispa)
GiDispa.class_register('stream',str);return str;}
function gli_delete_stream(str){var prev,next;if(str===gli_currentstr){gli_currentstr=null;}
gli_windows_unechostream(str);if(str.type==strtype_Memory){if(GiDispa)
GiDispa.unretain_array(str.buf);}
else if(str.type==strtype_File){if(str.fstream){str.fstream.fclose();str.fstream=null;}}
if(GiDispa)
GiDispa.class_unregister('stream',str);prev=str.prev;next=str.next;str.prev=null;str.next=null;if(prev)
prev.next=next;else
gli_streamlist=next;if(next)
next.prev=prev;str.fstream=null;str.buf=null;str.readable=false;str.writable=false;str.ref=null;str.win=null;str.file=null;str.rock=null;str.disprock=null;}
function gli_stream_open_window(win){var str;str=gli_new_stream(strtype_Window,false,true,0);str.unicode=true;str.win=win;return str;}
function gli_stream_dirty_file(str){if(str.streaming)
GlkOte.log('Bug: gli_stream_dirty_file called for streaming file!');if(str.timer_id===null){if(str.flush_func===null){str.flush_func=function(){gli_stream_flush_file(str);};}
str.timer_id=setTimeout(str.flush_func,10000);}}
function gli_stream_flush_file(str){var Dialog=GlkOte.getlibrary('Dialog');if(str.streaming)
GlkOte.log('Bug: gli_stream_flush_file called for streaming file!');if(!(str.timer_id===null)){clearTimeout(str.timer_id);}
str.timer_id=null;Dialog.file_write(str.ref,str.buf);}
function gli_new_fileref(filename,usage,rock,ref){var Dialog=GlkOte.getlibrary('Dialog');var fref={};fref.filename=filename;fref.rock=rock;fref.disprock=undefined;fref.textmode=((usage&Const.fileusage_TextMode)!=0);fref.filetype=(usage&Const.fileusage_TypeMask);fref.filetypename=FileTypeMap[fref.filetype];if(!fref.filetypename){fref.filetypename='xxx';}
if(!ref){var gameid='';if(fref.filetype==Const.fileusage_SavedGame)
gameid=VM.get_signature();ref=Dialog.file_construct_ref(fref.filename,fref.filetypename,gameid);}
fref.ref=ref;fref.prev=null;fref.next=gli_filereflist;gli_filereflist=fref;if(fref.next)
fref.next.prev=fref;if(GiDispa)
GiDispa.class_register('fileref',fref);return fref;}
function gli_delete_fileref(fref){var prev,next;if(GiDispa)
GiDispa.class_unregister('fileref',fref);prev=fref.prev;next=fref.next;fref.prev=null;fref.next=null;if(prev)
prev.next=next;else
gli_filereflist=next;if(next)
next.prev=prev;fref.filename=null;fref.ref=null;fref.rock=null;fref.disprock=null;}
function gli_put_char(str,ch){if(!str||!str.writable)
throw('gli_put_char: invalid stream');if(!str.unicode){if(ch<0||ch>=0x100)
ch=63;}
str.writecount+=1;switch(str.type){case strtype_File:if(str.streaming){if(!str.unicode){str.buffer4[0]=ch;str.fstream.fwrite(str.buffer4,1);}
else{if(!str.isbinary){var len;if(ch<0x10000){len=str.buffer4.write(String.fromCharCode(ch));str.fstream.fwrite(str.buffer4,len);}
else{var arr8=UniArrayToUTF8([ch]);var buf=str.fstream.BufferClass.from(arr8);str.fstream.fwrite(buf);}}
else{str.buffer4.writeUInt32BE(ch,0,true);str.fstream.fwrite(str.buffer4,4);}}}
else{gli_stream_dirty_file(str);if(!str.unicode||(ch<0x80&&!str.isbinary)){if(str.bufpos<str.buflen){str.buf[str.bufpos]=ch;str.bufpos+=1;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;}}
else{var arr;if(!str.isbinary)
arr=UniArrayToUTF8([ch]);else
arr=UniArrayToBE32([ch]);var len=arr.length;if(len>str.buflen-str.bufpos)
len=str.buflen-str.bufpos;for(var ix=0;ix<len;ix++)
str.buf[str.bufpos+ix]=arr[ix];str.bufpos+=len;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;}}
break;case strtype_Memory:if(str.bufpos<str.buflen){str.buf[str.bufpos]=ch;str.bufpos+=1;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;}
break;case strtype_Window:if(str.win.line_request)
throw('gli_put_char: window has pending line request');gli_window_put_string(str.win,CharToString(ch));if(str.win.echostr)
gli_put_char(str.win.echostr,ch);break;}}
function gli_put_array(str,arr,allbytes){var ix,len,val;if(!str||!str.writable)
throw('gli_put_array: invalid stream');if(!str.unicode&&!allbytes){arr=TrimArrayToBytes(arr);allbytes=true;}
str.writecount+=arr.length;switch(str.type){case strtype_File:if(str.streaming){if(!str.unicode){var buf=str.fstream.BufferClass.from(arr);str.fstream.fwrite(buf);}
else{if(!str.isbinary){var arr8=UniArrayToUTF8(arr);var buf=str.fstream.BufferClass.from(arr8);str.fstream.fwrite(buf);}
else{var buf=str.fstream.BufferClass.alloc(4*arr.length);for(ix=0;ix<arr.length;ix++){buf.writeUInt32BE(arr[ix],4*ix,true);}
str.fstream.fwrite(buf);}}}
else{gli_stream_dirty_file(str);var arr8;if(!str.unicode){arr8=arr;}
else{if(!str.isbinary)
arr8=UniArrayToUTF8(arr);else
arr8=UniArrayToBE32(arr);}
var len=arr8.length;if(len>str.buflen-str.bufpos)
len=str.buflen-str.bufpos;for(ix=0;ix<len;ix++)
str.buf[str.bufpos+ix]=arr8[ix];str.bufpos+=len;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;}
break;case strtype_Memory:len=arr.length;if(len>str.buflen-str.bufpos)
len=str.buflen-str.bufpos;for(ix=0;ix<len;ix++)
str.buf[str.bufpos+ix]=arr[ix];str.bufpos+=len;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;break;case strtype_Window:if(str.win.line_request)
throw('gli_put_array: window has pending line request');if(allbytes)
val=String.fromCharCode.apply(this,arr);else
val=UniArrayToString(arr);gli_window_put_string(str.win,val);if(str.win.echostr)
gli_put_array(str.win.echostr,arr,allbytes);break;}}
function gli_get_char(str,want_unicode){var ch;if(!str||!str.readable)
return-1;switch(str.type){case strtype_File:if(str.streaming){if(!str.unicode){var len=str.fstream.fread(str.buffer4,1);if(!len)
return-1;str.readcount++;return str.buffer4[0];}
else{if(!str.isbinary){var val0,val1,val2,val3;var len=str.fstream.fread(str.buffer4,1);if(!len)
return-1;val0=str.buffer4[0];if(val0<0x80){ch=val0;}
else{var len=str.fstream.fread(str.buffer4,1);if(!len)
return-1;val1=str.buffer4[0];if((val1&0xC0)!=0x80)
return-1;if((val0&0xE0)==0xC0){ch=(val0&0x1F)<<6;ch|=(val1&0x3F);}
else{var len=str.fstream.fread(str.buffer4,1);if(!len)
return-1;val2=str.buffer4[0];if((val2&0xC0)!=0x80)
return-1;if((val0&0xF0)==0xE0){ch=(((val0&0xF)<<12)&0x0000F000);ch|=(((val1&0x3F)<<6)&0x00000FC0);ch|=(((val2&0x3F))&0x0000003F);}
else if((val0&0xF0)==0xF0){var len=str.fstream.fread(str.buffer4,1);if(!len)
return-1;val3=str.buffer4[0];if((val3&0xC0)!=0x80)
return-1;ch=(((val0&0x7)<<18)&0x1C0000);ch|=(((val1&0x3F)<<12)&0x03F000);ch|=(((val2&0x3F)<<6)&0x000FC0);ch|=(((val3&0x3F))&0x00003F);}
else{return-1;}}}}
else{var len=str.fstream.fread(str.buffer4,4);if(len<4)
return-1;ch=(str.buffer4[0]<<24);ch|=(str.buffer4[1]<<16);ch|=(str.buffer4[2]<<8);ch|=str.buffer4[3];}
str.readcount++;ch>>>=0;if(!want_unicode&&ch>=0x100)
return 63;return ch;}}
case strtype_Resource:if(str.unicode){if(str.isbinary){if(str.bufpos>=str.bufeof)
return-1;ch=str.buf[str.bufpos];str.bufpos++;if(str.bufpos>=str.bufeof)
return-1;ch=(ch<<8)|(str.buf[str.bufpos]&0xFF);str.bufpos++;if(str.bufpos>=str.bufeof)
return-1;ch=(ch<<8)|(str.buf[str.bufpos]&0xFF);str.bufpos++;if(str.bufpos>=str.bufeof)
return-1;ch=(ch<<8)|(str.buf[str.bufpos]&0xFF);str.bufpos++;}
else{var val0,val1,val2,val3;if(str.bufpos>=str.bufeof)
return-1;val0=str.buf[str.bufpos];str.bufpos++;if(val0<0x80){ch=val0;}
else{if(str.bufpos>=str.bufeof)
return-1;val1=str.buf[str.bufpos];str.bufpos++;if((val1&0xC0)!=0x80)
return-1;if((val0&0xE0)==0xC0){ch=(val0&0x1F)<<6;ch|=(val1&0x3F);}
else{if(str.bufpos>=str.bufeof)
return-1;val2=str.buf[str.bufpos];str.bufpos++;if((val2&0xC0)!=0x80)
return-1;if((val0&0xF0)==0xE0){ch=(((val0&0xF)<<12)&0x0000F000);ch|=(((val1&0x3F)<<6)&0x00000FC0);ch|=(((val2&0x3F))&0x0000003F);}
else if((val0&0xF0)==0xF0){if(str.bufpos>=str.bufeof)
return-1;val3=str.buf[str.bufpos];str.bufpos++;if((val3&0xC0)!=0x80)
return-1;ch=(((val0&0x7)<<18)&0x1C0000);ch|=(((val1&0x3F)<<12)&0x03F000);ch|=(((val2&0x3F)<<6)&0x000FC0);ch|=(((val3&0x3F))&0x00003F);}
else{return-1;}}}}
str.readcount++;ch>>>=0;if(!want_unicode&&ch>=0x100)
return 63;return ch;}
case strtype_Memory:if(str.bufpos<str.bufeof){ch=str.buf[str.bufpos];str.bufpos++;str.readcount++;if(!want_unicode&&ch>=0x100)
return 63;return ch;}
else{return-1;}
default:return-1;}}
function gli_get_line(str,buf,want_unicode){if(!str||!str.readable)
return 0;var len=buf.length;var lx,ch;var gotnewline;switch(str.type){case strtype_File:if(str.streaming){if(len==0)
return 0;len-=1;gotnewline=false;for(lx=0;lx<len&&!gotnewline;lx++){ch=gli_get_char(str,want_unicode);if(ch==-1)
break;buf[lx]=ch;gotnewline=(ch==10);}
return lx;}
case strtype_Resource:if(str.unicode){if(len==0)
return 0;len-=1;gotnewline=false;for(lx=0;lx<len&&!gotnewline;lx++){ch=gli_get_char(str,want_unicode);if(ch==-1)
break;buf[lx]=ch;gotnewline=(ch==10);}
return lx;}
case strtype_Memory:if(len==0)
return 0;len-=1;if(str.bufpos>=str.bufeof){len=0;}
else{if(str.bufpos+len>str.bufeof){len=str.bufeof-str.bufpos;}}
gotnewline=false;if(!want_unicode){for(lx=0;lx<len&&!gotnewline;lx++){ch=str.buf[str.bufpos++];if(!want_unicode&&ch>=0x100)
ch=63;buf[lx]=ch;gotnewline=(ch==10);}}
else{for(lx=0;lx<len&&!gotnewline;lx++){ch=str.buf[str.bufpos++];buf[lx]=ch;gotnewline=(ch==10);}}
str.readcount+=lx;return lx;default:return 0;}}
function gli_get_buffer(str,buf,want_unicode){if(!str||!str.readable)
return 0;var len=buf.length;var lx,ch;switch(str.type){case strtype_File:if(str.streaming){for(lx=0;lx<len;lx++){ch=gli_get_char(str,want_unicode);if(ch==-1)
break;buf[lx]=ch;}
return lx;}
case strtype_Resource:if(str.unicode){for(lx=0;lx<len;lx++){ch=gli_get_char(str,want_unicode);if(ch==-1)
break;buf[lx]=ch;}
return lx;}
case strtype_Memory:if(str.bufpos>=str.bufeof){len=0;}
else{if(str.bufpos+len>str.bufeof){len=str.bufeof-str.bufpos;}}
if(!want_unicode){for(lx=0;lx<len;lx++){ch=str.buf[str.bufpos++];if(!want_unicode&&ch>=0x100)
ch=63;buf[lx]=ch;}}
else{for(lx=0;lx<len;lx++){buf[lx]=str.buf[str.bufpos++];}}
str.readcount+=len;return len;default:return 0;}}
function gli_stream_fill_result(str,result){if(!result)
return;result.set_field(0,str.readcount);result.set_field(1,str.writecount);}
function glk_put_jstring(val,allbytes){glk_put_jstring_stream(gli_currentstr,val,allbytes);}
function glk_put_jstring_stream(str,val,allbytes){var ix,len;if(!str||!str.writable)
throw('glk_put_jstring: invalid stream');str.writecount+=val.length;switch(str.type){case strtype_File:if(str.streaming){if(!str.unicode){var buf=str.fstream.BufferClass.from(val,'binary');str.fstream.fwrite(buf);}
else{if(!str.isbinary){var buf=str.fstream.BufferClass.from(val);str.fstream.fwrite(buf);}
else{var buf=str.fstream.BufferClass.alloc(4*val.length);for(ix=0;ix<val.length;ix++){buf.writeUInt32BE(val.charCodeAt(ix),4*ix,true);}
str.fstream.fwrite(buf);}}}
else{gli_stream_dirty_file(str);var arr=[];for(ix=0;ix<val.length;ix++)
arr.push(val.charCodeAt(ix));var arr8;if(!str.unicode){arr8=arr;}
else{if(!str.isbinary)
arr8=UniArrayToUTF8(arr);else
arr8=UniArrayToBE32(arr);}
var len=arr8.length;if(len>str.buflen-str.bufpos)
len=str.buflen-str.bufpos;for(ix=0;ix<len;ix++)
str.buf[str.bufpos+ix]=arr8[ix];str.bufpos+=len;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;}
break;case strtype_Memory:len=val.length;if(len>str.buflen-str.bufpos)
len=str.buflen-str.bufpos;if(str.unicode||allbytes){for(ix=0;ix<len;ix++)
str.buf[str.bufpos+ix]=val.charCodeAt(ix);}
else{for(ix=0;ix<len;ix++){var ch=val.charCodeAt(ix);if(ch<0||ch>=0x100)
ch=63;str.buf[str.bufpos+ix]=ch;}}
str.bufpos+=len;if(str.bufpos>str.bufeof)
str.bufeof=str.bufpos;break;case strtype_Window:if(str.win.line_request)
throw('glk_put_jstring: window has pending line request');gli_window_put_string(str.win,val);if(str.win.echostr)
glk_put_jstring_stream(str.win.echostr,val,allbytes);break;}}
function gli_set_style(str,val){if(!str||!str.writable)
throw('gli_set_style: invalid stream');if(val>=Const.style_NUMSTYLES)
val=0;if(str.type==strtype_Window){str.win.style=val;if(str.win.echostr)
gli_set_style(str.win.echostr,val);}}
function gli_set_hyperlink(str,val){if(!str||!str.writable)
throw('gli_set_hyperlink: invalid stream');if(str.type==strtype_Window){str.win.hyperlink=val;if(str.win.echostr)
gli_set_hyperlink(str.win.echostr,val);}}
function glk_exit(){has_exited=true;ui_disabled=true;gli_selectref=null;if(option_exit_warning)
GlkOte.warning(option_exit_warning);return DidNotReturn;}
function glk_tick(){}
function glk_gestalt(sel,val){return glk_gestalt_ext(sel,val,null);}
function glk_gestalt_ext(sel,val,arr){switch(sel){case 0:return 0x00000706;case 1:if(val<=Const.keycode_Left&&val>=Const.keycode_End)
return 1;if(val>=0x100000000-Const.keycode_MAXVAL)
return 0;if(val>0x10FFFF)
return 0;if((val>=0&&val<32)||(val>=127&&val<160))
return 0;return 1;case 2:if(val>0x10FFFF)
return 0;if((val>=0&&val<32)||(val>=127&&val<160))
return 0;return 1;case 3:if((val>0x10FFFF)||(val>=0&&val<32)||(val>=127&&val<160)){if(arr)
arr[0]=1;return 0;}
if(arr)
arr[0]=1;return 2;case 4:if(val==Const.wintype_TextBuffer)
return 1;if(val==Const.wintype_Graphics&&has_canvas)
return 1;return 0;case 5:return 1;case 6:return (window.tqCfg&&window.tqCfg.mediaEnabled===false)?0:1;case 7:case 24:return (window.tqCfg&&window.tqCfg.mediaEnabled===false)?0:1;case 8:return 1;case 9:return 1;case 10:return 1;case 11:return 1;case 12:if(val==3||val==4)
return 1;else
return 0;case 13:return 1;case 14:return (window.tqCfg&&window.tqCfg.mediaEnabled===false)?0:1;case 15:return 1;case 16:return 1;case 17:return 1;case 18:return 1;case 19:if(val==Const.keycode_Escape)
return 1;if(val>=Const.keycode_Func12&&val<=Const.keycode_Func1)
return 1;return 0;case 20:return 1;case 21:return 1;case 22:return 1;case 23:return 0;}
if(option_glk_gestalt_hook){var res=option_glk_gestalt_hook(sel,val,arr);if(res!==undefined)
return res;}
return 0;}
function glk_window_iterate(win,rockref){if(!win)
win=gli_windowlist;else
win=win.next;if(win){if(rockref)
rockref.set_value(win.rock);return win;}
if(rockref)
rockref.set_value(0);return null;}
function glk_window_get_rock(win){if(!win)
throw('glk_window_get_rock: invalid window');return win.rock;}
function glk_window_get_root(){return gli_rootwin;}
function glk_window_open(splitwin,method,size,wintype,rock){var oldparent,box,val;var pairwin,newwin;if(!gli_rootwin){if(splitwin)
throw('glk_window_open: splitwin must be null for first window');oldparent=null;box={left:content_metrics.outspacingx,top:content_metrics.outspacingy,right:content_metrics.width-content_metrics.outspacingx,bottom:content_metrics.height-content_metrics.outspacingy};}
else{if(!splitwin)
throw('glk_window_open: splitwin must not be null');val=(method&Const.winmethod_DivisionMask);if(val!=Const.winmethod_Fixed&&val!=Const.winmethod_Proportional)
throw('glk_window_open: invalid method (not fixed or proportional)');val=(method&Const.winmethod_DirMask);if(val!=Const.winmethod_Above&&val!=Const.winmethod_Below&&val!=Const.winmethod_Left&&val!=Const.winmethod_Right)
throw('glk_window_open: invalid method (bad direction)');box=splitwin.bbox;oldparent=splitwin.parent;if(oldparent&&oldparent.type!=Const.wintype_Pair)
throw('glk_window_open: parent window is not Pair');}
newwin=gli_new_window(wintype,rock);switch(newwin.type){case Const.wintype_TextBuffer:newwin.accum=[];newwin.accumstyle=null;newwin.accumhyperlink=0;newwin.content=[];newwin.clearcontent=false;newwin.reserve=[];break;case Const.wintype_TextGrid:newwin.gridwidth=0;newwin.gridheight=0;newwin.lines=[];newwin.cursorx=0;newwin.cursory=0;break;case Const.wintype_Graphics:if(!has_canvas){gli_delete_window(newwin);return null;}
newwin.content=[];newwin.reserve=[];break;case Const.wintype_Blank:break;case Const.wintype_Pair:throw('glk_window_open: cannot open pair window directly')
default:gli_delete_window(newwin);return null;}
if(!splitwin){gli_rootwin=newwin;gli_window_rearrange(newwin,box);}
else{pairwin=gli_new_window(Const.wintype_Pair,0);pairwin.pair_dir=method&Const.winmethod_DirMask;pairwin.pair_division=method&Const.winmethod_DivisionMask;pairwin.pair_key=newwin;pairwin.pair_keydamage=false;pairwin.pair_size=size;pairwin.pair_hasborder=((method&Const.winmethod_BorderMask)==Const.winmethod_Border);pairwin.pair_vertical=(pairwin.pair_dir==Const.winmethod_Left||pairwin.pair_dir==Const.winmethod_Right);pairwin.pair_backward=(pairwin.pair_dir==Const.winmethod_Left||pairwin.pair_dir==Const.winmethod_Above);pairwin.child1=splitwin;pairwin.child2=newwin;splitwin.parent=pairwin;newwin.parent=pairwin;pairwin.parent=oldparent;if(oldparent){if(oldparent.child1==splitwin)
oldparent.child1=pairwin;else
oldparent.child2=pairwin;}
else{gli_rootwin=pairwin;}
gli_window_rearrange(pairwin,box);}
return newwin;}
function glk_window_close(win,statsref){if(!win)
throw('glk_window_close: invalid window');if(win===gli_rootwin||!win.parent){gli_rootwin=null;gli_stream_fill_result(win.str,statsref);gli_window_close(win,true);}
else{var pairwin,grandparwin,sibwin,box,wx,keydamage_flag;pairwin=win.parent;if(win===pairwin.child1)
sibwin=pairwin.child2;else if(win===pairwin.child2)
sibwin=pairwin.child1;else
throw('glk_window_close: window tree is corrupted');box=pairwin.bbox;grandparwin=pairwin.parent;if(!grandparwin){gli_rootwin=sibwin;sibwin.parent=null;}
else{if(grandparwin.child1===pairwin)
grandparwin.child1=sibwin;else
grandparwin.child2=sibwin;sibwin.parent=grandparwin;}
gli_stream_fill_result(win.str,statsref);gli_window_close(win,true);if(win===pairwin.child1){pairwin.child1=null;}
else if(win===pairwin.child2){pairwin.child2=null;}
gli_window_close(pairwin,false);keydamage_flag=false;for(wx=sibwin;wx;wx=wx.parent){if(wx.type==Const.wintype_Pair){if(wx.pair_keydamage){keydamage_flag=true;wx.pair_keydamage=false;}}}
if(keydamage_flag){box=content_box;gli_window_rearrange(gli_rootwin,box);}
else{gli_window_rearrange(sibwin,box);}}}
function glk_window_get_size(win,widthref,heightref){if(!win)
throw('glk_window_get_size: invalid window');var wid=0;var hgt=0;var boxwidth,boxheight;switch(win.type){case Const.wintype_TextGrid:boxwidth=win.bbox.right-win.bbox.left;boxheight=win.bbox.bottom-win.bbox.top;wid=Math.max(0,Math.floor((boxwidth-content_metrics.gridmarginx)/content_metrics.gridcharwidth));hgt=Math.max(0,Math.floor((boxheight-content_metrics.gridmarginy)/content_metrics.gridcharheight));break;case Const.wintype_TextBuffer:boxwidth=win.bbox.right-win.bbox.left;boxheight=win.bbox.bottom-win.bbox.top;wid=Math.max(0,Math.floor((boxwidth-content_metrics.buffermarginx)/content_metrics.buffercharwidth));hgt=Math.max(0,Math.floor((boxheight-content_metrics.buffermarginy)/content_metrics.buffercharheight));break;case Const.wintype_Graphics:boxwidth=win.bbox.right-win.bbox.left;boxheight=win.bbox.bottom-win.bbox.top;wid=boxwidth-content_metrics.graphicsmarginx;hgt=boxheight-content_metrics.graphicsmarginy;break;}
if(widthref)
widthref.set_value(wid);if(heightref)
heightref.set_value(hgt);}
function glk_window_set_arrangement(win,method,size,keywin){var wx,newdir,newvertical,newbackward;if(!win)
throw('glk_window_set_arrangement: invalid window');if(win.type!=Const.wintype_Pair)
throw('glk_window_set_arrangement: not a pair window');if(keywin){if(keywin.type==Const.wintype_Pair)
throw('glk_window_set_arrangement: keywin cannot be a pair window');for(wx=keywin;wx;wx=wx.parent){if(wx==win)
break;}
if(!wx)
throw('glk_window_set_arrangement: keywin must be a descendant');}
newdir=method&Const.winmethod_DirMask;newvertical=(newdir==Const.winmethod_Left||newdir==Const.winmethod_Right);newbackward=(newdir==Const.winmethod_Left||newdir==Const.winmethod_Above);if(!keywin)
keywin=win.pair_key;if(newvertical&&!win.pair_vertical)
throw('glk_window_set_arrangement: split must stay horizontal');if(!newvertical&&win.pair_vertical)
throw('glk_window_set_arrangement: split must stay vertical');if(keywin&&keywin.type==Const.wintype_Blank&&(method&Const.winmethod_DivisionMask)==Const.winmethod_Fixed)
throw('glk_window_set_arrangement: a blank window cannot have a fixed size');if((newbackward&&!win.pair_backward)||(!newbackward&&win.pair_backward)){wx=win.child1;win.child1=win.child2;win.child2=wx;}
win.pair_dir=newdir;win.pair_division=(method&Const.winmethod_DivisionMask);win.pair_key=keywin;win.pair_size=size;win.pair_hasborder=((method&Const.winmethod_BorderMask)==Const.winmethod_Border);win.pair_vertical=(win.pair_dir==Const.winmethod_Left||win.pair_dir==Const.winmethod_Right);win.pair_backward=(win.pair_dir==Const.winmethod_Left||win.pair_dir==Const.winmethod_Above);gli_window_rearrange(win,win.bbox);}
function glk_window_get_arrangement(win,methodref,sizeref,keywinref){if(!win)
throw('glk_window_get_arrangement: invalid window');if(win.type!=Const.wintype_Pair)
throw('glk_window_get_arrangement: not a pair window');if(sizeref)
sizeref.set_value(win.pair_size);if(keywinref)
keywinref.set_value(win.pair_key);if(methodref)
methodref.set_value(win.pair_dir|win.pair_division|(win.pair_hasborder?Const.winmethod_Border:Const.winmethod_NoBorder));}
function glk_window_get_type(win){if(!win)
throw('glk_window_get_type: invalid window');return win.type;}
function glk_window_get_parent(win){if(!win)
throw('glk_window_get_parent: invalid window');return win.parent;}
function glk_window_clear(win){var ix,cx,lineobj;if(!win)
throw('glk_window_clear: invalid window');if(win.line_request){throw('glk_window_clear: window has pending line request');}
switch(win.type){case Const.wintype_TextBuffer:win.accum.length=0;win.accumstyle=null;win.accumhyperlink=0;win.content.length=0;win.clearcontent=true;break;case Const.wintype_TextGrid:win.cursorx=0;win.cursory=0;for(ix=0;ix<win.gridheight;ix++){lineobj=win.lines[ix];lineobj.dirty=true;for(cx=0;cx<win.gridwidth;cx++){lineobj.chars[cx]=' ';lineobj.styles[cx]=Const.style_Normal;lineobj.hyperlinks[cx]=0;}}
break;case Const.wintype_Graphics:var setcol=null;for(var ix=0;ix<win.content.length;ix++){if(win.content[ix].special=='setcolor')
setcol=win.content[ix];}
win.content.length=0;if(setcol!==null)
win.content.push(setcol);win.content.push({special:'fill'});break;}}
function glk_window_move_cursor(win,xpos,ypos){if(!win)
throw('glk_window_move_cursor: invalid window');if(win.type==Const.wintype_TextGrid){win.cursorx=xpos;win.cursory=ypos;}
else{throw('glk_window_move_cursor: not a grid window');}}
function glk_window_get_stream(win){if(!win)
throw('glk_window_get_stream: invalid window');return win.str;}
function glk_window_set_echo_stream(win,str){if(!win)
throw('glk_window_set_echo_stream: invalid window');win.echostr=str;}
function glk_window_get_echo_stream(win){if(!win)
throw('glk_window_get_echo_stream: invalid window');return win.echostr;}
function glk_set_window(win){if(!win)
gli_currentstr=null;else
gli_currentstr=win.str;}
function glk_window_get_sibling(win){var parent,sib;if(!win)
throw('glk_window_get_sibling: invalid window');parent=win.parent;if(!parent)
return null;if(win===parent.child1)
return parent.child2;else if(win===parent.child2)
return parent.child1;else
throw('glk_window_get_sibling: window tree is corrupted');}
function glk_stream_iterate(str,rockref){if(!str)
str=gli_streamlist;else
str=str.next;if(str){if(rockref)
rockref.set_value(str.rock);return str;}
if(rockref)
rockref.set_value(0);return null;}
function glk_stream_get_rock(str){if(!str)
throw('glk_stream_get_rock: invalid stream');return str.rock;}
function glk_stream_open_file(fref,fmode,rock){var Dialog=GlkOte.getlibrary('Dialog');if(!fref)
throw('glk_stream_open_file: invalid fileref');var str;var fstream;if(fmode!=Const.filemode_Read&&fmode!=Const.filemode_Write&&fmode!=Const.filemode_ReadWrite&&fmode!=Const.filemode_WriteAppend)
throw('glk_stream_open_file: illegal filemode');if(fmode==Const.filemode_Read&&!Dialog.file_ref_exists(fref.ref))
return null;if(!Dialog.streaming){var content=null;if(fmode!=Const.filemode_Write){content=Dialog.file_read(fref.ref);}
if(content==null){content=[];if(fmode!=Const.filemode_Read){Dialog.file_write(fref.ref,'',true);}}
if(content.length==null)
throw('glk_stream_open_file: data read had no length');}
else{fstream=Dialog.file_fopen(fmode,fref.ref);if(!fstream)
return null;}
str=gli_new_stream(strtype_File,(fmode!=Const.filemode_Write),(fmode!=Const.filemode_Read),rock);str.unicode=false;str.isbinary=!fref.textmode;str.ref=fref.ref;str.origfmode=fmode;if(!Dialog.streaming){str.streaming=false;str.buf=content;str.buflen=0xFFFFFFFF;if(fmode==Const.filemode_Write)
str.bufeof=0;else
str.bufeof=content.length;if(fmode==Const.filemode_WriteAppend)
str.bufpos=str.bufeof;else
str.bufpos=0;}
else{str.streaming=true;str.fstream=fstream;str.buffer4=fstream.BufferClass.alloc(4);}
return str;}
function glk_stream_open_memory(buf,fmode,rock){var str;if(fmode!=Const.filemode_Read&&fmode!=Const.filemode_Write&&fmode!=Const.filemode_ReadWrite)
throw('glk_stream_open_memory: illegal filemode');str=gli_new_stream(strtype_Memory,(fmode!=Const.filemode_Write),(fmode!=Const.filemode_Read),rock);str.unicode=false;if(buf){str.buf=buf;str.buflen=buf.length;str.bufpos=0;if(fmode==Const.filemode_Write)
str.bufeof=0;else
str.bufeof=str.buflen;if(GiDispa)
GiDispa.retain_array(buf);}
return str;}
function glk_stream_open_resource(filenum,rock){var str;if(!Blorb)
return null;var el=Blorb.get_data_chunk(filenum);if(!el)
return null;var buf=el.data;str=gli_new_stream(strtype_Resource,true,false,rock);str.unicode=false;str.isbinary=el.binary;str.resfilenum=filenum;str.streaming=false;if(buf){str.buf=buf;str.buflen=buf.length;str.bufpos=0;str.bufeof=str.buflen;}
return str;}
function glk_stream_open_resource_uni(filenum,rock){var str;if(!Blorb)
return null;var el=Blorb.get_data_chunk(filenum);if(!el)
return null;var buf=el.data;str=gli_new_stream(strtype_Resource,true,false,rock);str.unicode=true;str.isbinary=el.binary;str.resfilenum=filenum;str.streaming=false;if(buf){str.buf=buf;str.buflen=buf.length;str.bufpos=0;str.bufeof=str.buflen;}
return str;}
function glk_stream_close(str,result){var Dialog=GlkOte.getlibrary('Dialog');if(!str)
throw('glk_stream_close: invalid stream');if(str.type==strtype_Window)
throw('glk_stream_close: cannot close window stream');if(str.type==strtype_File&&str.writable){if(!str.streaming){if(!(str.timer_id===null)){clearTimeout(str.timer_id);str.timer_id=null;}
Dialog.file_write(str.ref,str.buf);}}
gli_stream_fill_result(str,result);gli_delete_stream(str);}
function glk_stream_set_position(str,pos,seekmode){if(!str)
throw('glk_stream_set_position: invalid stream');switch(str.type){case strtype_File:if(str.streaming){str.fstream.fseek(pos,seekmode);break;}
case strtype_Resource:case strtype_Memory:if(seekmode==Const.seekmode_Current){pos=str.bufpos+pos;}
else if(seekmode==Const.seekmode_End){pos=str.bufeof+pos;}
else{}
if(pos<0)
pos=0;if(pos>str.bufeof)
pos=str.bufeof;str.bufpos=pos;}}
function glk_stream_get_position(str){if(!str)
throw('glk_stream_get_position: invalid stream');switch(str.type){case strtype_File:if(str.streaming){return str.fstream.ftell();}
case strtype_Resource:case strtype_Memory:return str.bufpos;default:return 0;}}
function glk_stream_set_current(str){gli_currentstr=str;}
function glk_stream_get_current(){return gli_currentstr;}
function glk_fileref_create_temp(usage,rock){var Dialog=GlkOte.getlibrary('Dialog');var filetype=(usage&Const.fileusage_TypeMask);var filetypename=FileTypeMap[filetype];var ref=Dialog.file_construct_temp_ref(filetypename);var fref=gli_new_fileref(ref.filename,usage,rock,ref);return fref;}
function glk_fileref_create_by_name(usage,filename,rock){var Dialog=GlkOte.getlibrary('Dialog');filename=Dialog.file_clean_fixed_name(filename,(usage&Const.fileusage_TypeMask));var fref=gli_new_fileref(filename,usage,rock,null);return fref;}
function glk_fileref_create_by_prompt(usage,fmode,rock){var modename;var filetype=(usage&Const.fileusage_TypeMask);var filetypename=FileTypeMap[filetype];if(!filetypename){filetypename='xxx';}
switch(fmode){case Const.filemode_Write:modename='write';break;case Const.filemode_ReadWrite:modename='readwrite';break;case Const.filemode_WriteAppend:modename='writeappend';break;case Const.filemode_Read:default:modename='read';break;}
var special={type:'fileref_prompt',filetype:filetypename,filemode:modename};var callback={usage:usage,rock:rock};if(filetype==Const.fileusage_SavedGame)
special.gameid=VM.get_signature();ui_specialinput=special;ui_specialcallback=callback;gli_selectref=null;return DidNotReturn;}
function gli_fileref_create_by_prompt_callback(obj){var ref=obj.value;var usage=ui_specialcallback.usage;var rock=ui_specialcallback.rock;var fref=null;if(ref&&typeof(ref)=='object'){fref=gli_new_fileref(ref.filename,usage,rock,ref);}
else if(ref&&typeof(ref)=='string'){fref=gli_new_fileref(ref,usage,rock,null);}
ui_specialinput=null;ui_specialcallback=null;if(GiDispa)
GiDispa.prepare_resume(fref);VM.resume(fref);}
function glk_fileref_destroy(fref){if(!fref)
throw('glk_fileref_destroy: invalid fileref');gli_delete_fileref(fref);}
function glk_fileref_iterate(fref,rockref){if(!fref)
fref=gli_filereflist;else
fref=fref.next;if(fref){if(rockref)
rockref.set_value(fref.rock);return fref;}
if(rockref)
rockref.set_value(0);return null;}
function glk_fileref_get_rock(fref){if(!fref)
throw('glk_fileref_get_rock: invalid fileref');return fref.rock;}
function glk_fileref_delete_file(fref){var Dialog=GlkOte.getlibrary('Dialog');if(!fref)
throw('glk_fileref_delete_file: invalid fileref');Dialog.file_remove_ref(fref.ref);}
function glk_fileref_does_file_exist(fref){var Dialog=GlkOte.getlibrary('Dialog');if(!fref)
throw('glk_fileref_does_file_exist: invalid fileref');if(Dialog.file_ref_exists(fref.ref))
return 1;else
return 0;}
function glk_fileref_create_from_fileref(usage,oldfref,rock){if(!oldfref)
throw('glk_fileref_create_from_fileref: invalid fileref');var fref=gli_new_fileref(oldfref.filename,usage,rock,null);return fref;}
function glk_put_char(ch){gli_put_char(gli_currentstr,ch&0xFF);}
function glk_put_char_stream(str,ch){gli_put_char(str,ch&0xFF);}
function glk_put_string(val){glk_put_jstring_stream(gli_currentstr,val,true);}
function glk_put_string_stream(str,val){glk_put_jstring_stream(str,val,true);}
function glk_put_buffer(arr){arr=TrimArrayToBytes(arr);gli_put_array(gli_currentstr,arr,true);}
function glk_put_buffer_stream(str,arr){arr=TrimArrayToBytes(arr);gli_put_array(str,arr,true);}
function glk_set_style(val){gli_set_style(gli_currentstr,val);}
function glk_set_style_stream(str,val){gli_set_style(str,val);}
function glk_get_char_stream(str){if(!str)
throw('glk_get_char_stream: invalid stream');return gli_get_char(str,false);}
function glk_get_line_stream(str,buf){if(!str)
throw('glk_get_line_stream: invalid stream');return gli_get_line(str,buf,false);}
function glk_get_buffer_stream(str,buf){if(!str)
throw('glk_get_buffer_stream: invalid stream');return gli_get_buffer(str,buf,false);}
function glk_char_to_lower(val){if(val>=0x41&&val<=0x5A)
return val+0x20;if(val>=0xC0&&val<=0xDE&&val!=0xD7)
return val+0x20;return val;}
function glk_char_to_upper(val){if(val>=0x61&&val<=0x7A)
return val-0x20;if(val>=0xE0&&val<=0xFE&&val!=0xF7)
return val-0x20;return val;}
function glk_stylehint_set(wintype,styl,hint,value){}
function glk_stylehint_clear(wintype,styl,hint){}
function glk_style_distinguish(win,styl1,styl2){return 0;}
function glk_style_measure(win,styl,hint,resultref){if(resultref)
resultref.set_value(0);return 0;}
function glk_select(eventref){gli_selectref=eventref;gli_sound_flush_pending();return DidNotReturn;}
function glk_select_poll(eventref){eventref.set_field(0,Const.evtype_None);eventref.set_field(1,null);eventref.set_field(2,0);eventref.set_field(3,0);if(gli_timer_interval){var now=Date.now();if(now-gli_timer_started>gli_timer_interval){gli_timer_started=Date.now();gli_timer_lastsent=null;eventref.set_field(0,Const.evtype_Timer);}}}
function glk_request_line_event(win,buf,initlen){if(!win)
throw('glk_request_line_event: invalid window');if(win.char_request||win.line_request)
throw('glk_request_line_event: window already has keyboard request');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){if(initlen){var ls=buf.slice(0,initlen);if(!current_partial_outputs)
current_partial_outputs={};current_partial_outputs[win.disprock]=ByteArrayToString(ls);}
win.line_request=true;win.line_request_uni=false;if(win.type==Const.wintype_TextBuffer)
win.request_echo_line_input=win.echo_line_input;else
win.request_echo_line_input=true;win.input_generation=event_generation;win.linebuf=buf;if(GiDispa)
GiDispa.retain_array(buf);}
else{throw('glk_request_line_event: window does not support keyboard input');}}
function glk_cancel_line_event(win,eventref){if(!win)
throw('glk_cancel_line_event: invalid window');if(!win.line_request){if(eventref){eventref.set_field(0,Const.evtype_None);eventref.set_field(1,null);eventref.set_field(2,0);eventref.set_field(3,0);}
return;}
var input="";var ix,val;if(current_partial_inputs){val=current_partial_inputs[win.disprock];if(val)
input=val;}
if(input.length>win.linebuf.length)
input=input.slice(0,win.linebuf.length);if(win.request_echo_line_input){ix=win.style;gli_set_style(win.str,Const.style_Input);gli_window_put_string(win,input);if(win.echostr)
glk_put_jstring_stream(win.echostr,input);gli_set_style(win.str,ix);gli_window_put_string(win,"\n");if(win.echostr)
glk_put_jstring_stream(win.echostr,"\n");}
for(ix=0;ix<input.length;ix++)
win.linebuf[ix]=input.charCodeAt(ix);if(eventref){eventref.set_field(0,Const.evtype_LineInput);eventref.set_field(1,win);eventref.set_field(2,input.length);eventref.set_field(3,0);}
if(GiDispa)
GiDispa.unretain_array(win.linebuf);win.line_request=false;win.line_request_uni=false;win.request_echo_line_input=null;win.input_generation=null;win.linebuf=null;}
function glk_request_char_event(win){if(!win)
throw('glk_request_char_event: invalid window');if(win.char_request||win.line_request)
throw('glk_request_char_event: window already has keyboard request');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){win.char_request=true;win.char_request_uni=false;win.input_generation=event_generation;}
else{throw('glk_request_char_event: window does not support keyboard input');}}
function glk_cancel_char_event(win){if(!win)
throw('glk_cancel_char_event: invalid window');win.char_request=false;win.char_request_uni=false;}
function glk_set_echo_line_event(win,val){if(!win)
throw('glk_set_echo_line_event: invalid window');win.echo_line_input=(val!=0);}
function glk_set_terminators_line_event(win,arr){if(!win)
throw('glk_set_terminators_line_event: invalid window');if(KeystrokeValueMap===null){KeystrokeValueMap={};for(var val in KeystrokeNameMap){KeystrokeValueMap[KeystrokeNameMap[val]]=val;}}
var res=[];if(arr){for(var ix=0;ix<arr.length;ix++){var val=KeystrokeValueMap[arr[ix]];if(val)
res.push(val);}}
win.line_input_terminators=res;}
function glk_request_mouse_event(win){if(!win)
throw('glk_request_mouse_event: invalid window');if(win.type==Const.wintype_TextGrid||win.type==Const.wintype_Graphics){win.mouse_request=true;}}
function glk_cancel_mouse_event(win){if(!win)
throw('glk_cancel_mouse_event: invalid window');win.mouse_request=false;}
function glk_request_timer_events(msec){if(!msec){gli_timer_interval=null;gli_timer_started=null;}
else{gli_timer_interval=msec;gli_timer_started=Date.now();}}
function glk_image_get_info(imgid,widthref,heightref){if(!Blorb||!Blorb.get_image_info)
return null;var info=Blorb.get_image_info(imgid);if(info){if(widthref)
widthref.set_value(info.width);if(heightref)
heightref.set_value(info.height);return 1;}
if(widthref)
widthref.set_value(0);if(heightref)
heightref.set_value(0);return 0;}
function glk_image_draw(win,imgid,val1,val2){if(window.tqCfg&&window.tqCfg.mediaEnabled===false)return 0;if(!win)
throw('glk_image_draw: invalid window');if(!Blorb||!Blorb.get_image_info)
return 0;var info=Blorb.get_image_info(imgid);if(!info)
return 0;var img={special:'image',image:imgid,url:info.url,alttext:info.alttext,width:info.width,height:info.height};switch(win.type){case Const.wintype_TextBuffer:var alignment='inlineup';switch(val1){case Const.imagealign_InlineUp:alignment='inlineup';break;case Const.imagealign_InlineDown:alignment='inlinedown';break;case Const.imagealign_InlineCenter:alignment='inlinecenter';break;case Const.imagealign_MarginLeft:alignment='marginleft';break;case Const.imagealign_MarginRight:alignment='marginright';break;}
img.alignment=alignment;if(win.hyperlink)
img.hyperlink=win.hyperlink;gli_window_buffer_put_special(win,img);return 1;case Const.wintype_Graphics:img.x=val1;img.y=val2;win.content.push(img);return 1;}
return 0;}
function glk_image_draw_scaled(win,imgid,val1,val2,width,height){if(window.tqCfg&&window.tqCfg.mediaEnabled===false)return 0;if(!win)
throw('glk_image_draw_scaled: invalid window');if(!Blorb||!Blorb.get_image_info)
return 0;var info=Blorb.get_image_info(imgid);if(!info)
return 0;var img={special:'image',image:imgid,url:info.url,alttext:info.alttext,width:width,height:height};switch(win.type){case Const.wintype_TextBuffer:var alignment='inlineup';switch(val1){case Const.imagealign_InlineUp:alignment='inlineup';break;case Const.imagealign_InlineDown:alignment='inlinedown';break;case Const.imagealign_InlineCenter:alignment='inlinecenter';break;case Const.imagealign_MarginLeft:alignment='marginleft';break;case Const.imagealign_MarginRight:alignment='marginright';break;}
img.alignment=alignment;if(win.hyperlink)
img.hyperlink=win.hyperlink;gli_window_buffer_put_special(win,img);return 1;case Const.wintype_Graphics:img.x=val1;img.y=val2;win.content.push(img);return 1;}
return 0;}
function glk_image_draw_scaled_ext(win,imgid,val1,val2,width,height,imagerule,maxwidth){if(window.tqCfg&&window.tqCfg.mediaEnabled===false)return 0;if(!win)
throw('glk_image_draw_scaled_ext: invalid window');if(!Blorb||!Blorb.get_image_info)
return 0;var info=Blorb.get_image_info(imgid);if(!info)
return 0;var img={special:'image',image:imgid,url:info.url,alttext:info.alttext};var widthrule=(imagerule&Const.imagerule_WidthMask);var heightrule=(imagerule&Const.imagerule_HeightMask);if(win.type==Const.wintype_Graphics){if(widthrule==Const.imagerule_WidthRatio){widthrule=Const.imagerule_WidthFixed;width=win.graphwidth*(width/0x10000);}
if(heightrule==Const.imagerule_AspectRatio){heightrule=Const.imagerule_HeightFixed;var aspect=(info.height/info.width);height=width*aspect*(height/0x10000);}
maxwidth=0;}
switch(widthrule){case Const.imagerule_WidthOrig:img.width=info.width;break;case Const.imagerule_WidthFixed:img.width=width;break;case Const.imagerule_WidthRatio:img.widthratio=(width/0x10000);break;default:throw('glk_image_draw_scaled_ext: invalid widthrule');}
switch(heightrule){case Const.imagerule_HeightOrig:img.height=info.height;break;case Const.imagerule_HeightFixed:img.height=height;break;case Const.imagerule_AspectRatio:var aspectratio=(height/0x10000);img.aspectwidth=info.width;img.aspectheight=info.height*aspectratio;break;default:throw('glk_image_draw_scaled_ext: invalid heightrule');}
if(maxwidth==0){img.winmaxwidth=null;}
else{var maxwidthf=(maxwidth/0x10000);img.winmaxwidth=maxwidthf;if(widthrule==Const.imagerule_WidthRatio){if(img.widthratio>img.winmaxwidth){if(img.height!==undefined)
img.height=img.height*(img.winmaxwidth/img.widthratio);img.widthratio=img.winmaxwidth;}
img.winmaxwidth=null;}}
switch(win.type){case Const.wintype_TextBuffer:var alignment='inlineup';switch(val1){case Const.imagealign_InlineUp:alignment='inlineup';break;case Const.imagealign_InlineDown:alignment='inlinedown';break;case Const.imagealign_InlineCenter:alignment='inlinecenter';break;case Const.imagealign_MarginLeft:alignment='marginleft';break;case Const.imagealign_MarginRight:alignment='marginright';break;}
img.alignment=alignment;if(win.hyperlink)
img.hyperlink=win.hyperlink;gli_window_buffer_put_special(win,img);return 1;case Const.wintype_Graphics:img.x=val1;img.y=val2;win.content.push(img);return 1;}
return 0;}
function glk_window_flow_break(win){if(!win)
throw('glk_window_flow_break: invalid window');if(win.type==Const.wintype_TextBuffer)
gli_window_buffer_put_special(win,undefined,true);}
function glk_window_erase_rect(win,left,top,width,height){if(!win)
throw('glk_window_erase_rect: invalid window');if(win.type!=Const.wintype_Graphics)
throw('glk_window_erase_rect: not a graphics window');win.content.push({special:'fill',x:left,y:top,width:width,height:height});}
function glk_window_fill_rect(win,color,left,top,width,height){if(!win)
throw('glk_window_fill_rect: invalid window');if(win.type!=Const.wintype_Graphics)
throw('glk_window_fill_rect: not a graphics window');var colstr=gli_color_to_css(color);win.content.push({special:'fill',color:colstr,x:left,y:top,width:width,height:height});}
function glk_window_set_background_color(win,color){if(!win)
throw('glk_window_set_background_color: invalid window');if(win.type!=Const.wintype_Graphics)
throw('glk_window_set_background_color: not a graphics window');var colstr=gli_color_to_css(color);win.content.push({special:'setcolor',color:colstr});}
function gli_color_to_css(color){var res=(color&0xFFFFFF).toString(16);while(res.length<6){res='0'+res;}
return'#'+res.toUpperCase();}
function glk_schannel_iterate(schan,rockref){if(!schan)
schan=gli_schannellist;else
schan=schan.next;if(schan){if(rockref)
rockref.set_value(schan.rock);return schan;}
if(rockref)
rockref.set_value(0);return null;}
function glk_schannel_get_rock(schan){if(!schan)
throw('glk_schannel_get_rock: invalid schannel');return schan.rock;}
/* ---------------- Sound support ---------------- */
var gli_sound_urls = {};
var gli_sound_pending = [];
var gli_sound_retry_queue = [];
window.__tqAudioUnlocked = false;

function tq_unlock_audio() {
    if (window.__tqAudioUnlocked) return;
    try {
        var pr = new Audio().play();
        if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
    window.__tqAudioUnlocked = true;
    tq_process_sound_retry_queue();
}
/* Экспорт в глобальную область: bindUI() живёт в отдельном IIFE приложения,
   а эти функции — внутри GiLoadClass. Без window. ссылки из app-IIFE не видны. */
window.tq_unlock_audio = tq_unlock_audio;

function tq_sound_enqueue_retry(schan, sndid, repeats, notify) {
    gli_sound_retry_queue.push({ schan: schan, sndid: sndid, repeats: repeats, notify: notify });
}

function tq_process_sound_retry_queue() {
    if (!window.__tqAudioUnlocked) return;
    var q = gli_sound_retry_queue;
    gli_sound_retry_queue = [];
    for (var i = 0; i < q.length; i++) {
        var item = q[i];
        try {
            var a = item.schan && item.schan.audio;
            if (a) {
                var pr = a.play();
                if (pr && pr.catch) pr.catch(function () {});
            }
        } catch (e) {}
    }
}

function gli_sound_notify(sndid) {
  if (gli_selectref) {
    handle_external_input({ type: Const.evtype_SoundNotify, val1: sndid, val2: 0 });
  } else {
    gli_sound_pending.push(sndid);
  }
}
function gli_sound_flush_pending() {
  if (!gli_selectref || !gli_sound_pending.length) return;
  var id = gli_sound_pending.shift();
  setTimeout(function () {
    if (gli_selectref) handle_external_input({ type: Const.evtype_SoundNotify, val1: id, val2: 0 });
  }, 0);
}
function tqsnd_u16(b, o) { return ((b[o] << 8) | b[o + 1]) & 0xffff; }
function tqsnd_u32(b, o) { return (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0); }
function tqsnd_str(b, o) { return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]); }
function tqsnd_ext80(b, o) {
  var e = ((b[o] << 8) | b[o + 1]) & 0x7fff;
  var hi = tqsnd_u32(b, o + 2), lo = tqsnd_u32(b, o + 6);
  var sign = (b[o] & 0x80) ? -1 : 1;
  if (e === 0 && hi === 0 && lo === 0) return 0;
  return sign * (hi * 4294967296 + lo) * Math.pow(2, e - 16383 - 63);
}
/* AIFF/AIFC (PCM) -> WAV, so Android WebView can decode it. */
function tqsnd_aiff_to_wav(b) {
  var p = 12, comm = null, ssnd = null;
  while (p + 8 <= b.length) {
    var id = tqsnd_str(b, p);
    var len = tqsnd_u32(b, p + 4);
    p += 8;
    if (id === 'COMM' && len >= 18) {
      comm = { ch: tqsnd_u16(b, p), bits: tqsnd_u16(b, p + 6), rate: tqsnd_ext80(b, p + 8), comp: 'NONE' };
      if (len >= 22 && p + 22 <= b.length) {
        var c = tqsnd_str(b, p + 18);
        if (/^[A-Za-z0-9 ]{4}$/.test(c)) comm.comp = c;
      }
    } else if (id === 'SSND' && len >= 8) {
      var off = tqsnd_u32(b, p);
      var start = p + 8 + off;
      ssnd = { start: start, len: Math.max(0, Math.min(len - 8 - off, b.length - start)) };
    }
    p += len + (len & 1);
  }
  if (!comm || !ssnd) return null;
  var comp = comm.comp || 'NONE';
  if (comp !== 'NONE' && comp !== 'twos' && comp !== 'sowt') return null;
  var ch = comm.ch || 1, bits = comm.bits || 16, rate = Math.round(comm.rate) || 44100;
  if (ch < 1 || ch > 8 || bits < 8 || bits > 32) return null;
  var bytesPer = bits >> 3;
  var frames = Math.floor(ssnd.len / (bytesPer * ch));
  if (!frames) return null;
  var outLen = frames * ch * 2;
  var wav = new Uint8Array(44 + outLen);
  function wr32(o, v) { wav[o] = v & 0xff; wav[o + 1] = (v >> 8) & 0xff; wav[o + 2] = (v >> 16) & 0xff; wav[o + 3] = (v >> 24) & 0xff; }
  function wr16(o, v) { wav[o] = v & 0xff; wav[o + 1] = (v >> 8) & 0xff; }
  function wrstr(o, s) { for (var i = 0; i < 4; i++) wav[o + i] = s.charCodeAt(i); }
  wrstr(0, 'RIFF'); wr32(4, 36 + outLen); wrstr(8, 'WAVE'); wrstr(12, 'fmt ');
  wr32(16, 16); wr16(20, 1); wr16(22, ch); wr32(24, rate);
  wr32(28, rate * ch * 2); wr16(32, ch * 2); wr16(34, 16); wrstr(36, 'data'); wr32(40, outLen);
  var src = ssnd.start, d = 44;
  for (var f = 0; f < frames; f++) {
    for (var cc = 0; cc < ch; cc++) {
      var v = 0;
      if (bits === 16) {
        v = (comp === 'sowt') ? ((b[src + 1] << 8) | b[src]) : (((b[src] << 8) | b[src + 1]) << 16 >> 16);
      } else if (bits === 8) {
        v = ((b[src] << 24) >> 24) * 256;
      } else if (bits === 24) {
        v = (comp === 'sowt') ? (((b[src + 1] << 8) | b[src + 2]) << 16 >> 16)
                              : (((b[src] << 8) | b[src + 1]) << 16 >> 16);
      } else {
        v = (comp === 'sowt') ? (((b[src + 2] << 8) | b[src + 3]) << 16 >> 16)
                              : (((b[src] << 8) | b[src + 1]) << 16 >> 16);
      }
      wr16(d, v); d += 2; src += bytesPer;
    }
  }
  return wav;
}
function tqsnd_blob(data, type) {
  try { return URL.createObjectURL(new Blob([data], { type: type })); } catch (e) { return null; }
}
function gli_sound_url(sndid) {
  if (Object.prototype.hasOwnProperty.call(gli_sound_urls, sndid)) return gli_sound_urls[sndid];
  var url = null;
  try {
    var chunk = (Blorb && Blorb.get_chunk) ? Blorb.get_chunk('sound', sndid) : null;
    if (chunk && chunk.content) {
      var b = chunk.content, type = chunk.blorbtype;
      if (type === 'FORM') {
        var form = tqsnd_str(b, 8);
        if (form === 'AIFF' || form === 'AIFC') {
          var wav = tqsnd_aiff_to_wav(b);
          if (wav) url = tqsnd_blob(wav, 'audio/wav');
        } else if (form === 'WAVE') {
          url = tqsnd_blob(b, 'audio/wav');
        }
      } else if (type === 'OGG ') {
        url = tqsnd_blob(b, 'audio/ogg');
      } else if (type === 'WAVE') {
        url = tqsnd_blob(b, 'audio/wav');
      }
    }
  } catch (e) { url = null; }
  gli_sound_urls[sndid] = url;
  return url;
}
function gli_schan_volume(schan) { return Math.max(0, Math.min(1, (schan.volume || 0) / 65536)); }
function gli_schan_stop(schan) {
  if (schan.audio) {
    try { schan.audio.pause(); } catch (e) {}
    schan.audio.onended = null;
    schan.audio = null;
  }
  schan.sndid = 0; schan.repeats = 0; schan.notify = false; schan.paused = false;
}
function gli_stop_all_sound() {
  var s = gli_schannellist;
  while (s) { gli_schan_stop(s); s = s.next; }
}
window.tqStopAllSound = gli_stop_all_sound;
function gli_schan_play(schan, sndid, repeats, notify) {
  if (!schan) return 0;
  if (window.tqCfg && window.tqCfg.soundEnabled === false) { gli_schan_stop(schan); return 0; }
  gli_schan_stop(schan);
  var url = gli_sound_url(sndid);
  if (!url || typeof Audio === 'undefined') return 0;
  var a;
  try { a = new Audio(url); } catch (e) { return 0; }
  a.volume = gli_schan_volume(schan);
  a.preload = 'auto';
  schan.audio = a; schan.sndid = sndid; schan.repeats = repeats;
  schan.notify = !!notify; schan.paused = false;
  var left = repeats;
  var fire = function () {
    try {
        var pr = a.play();
        if (pr && pr.catch) pr.catch(function (e) {
            tq_sound_enqueue_retry(schan, sndid, repeats, notify);
        });
    } catch (e) {
        tq_sound_enqueue_retry(schan, sndid, repeats, notify);
    }
  };
  a.onended = function () {
    if (schan.audio !== a) return;
    if (left === 0xFFFFFFFF) {
      try { a.currentTime = 0; } catch (e) {}
      fire(); return;
    }
    if (left > 1) {
      left -= 1;
      try { a.currentTime = 0; } catch (e) {}
      fire(); return;
    }
    schan.audio = null; schan.sndid = 0;
    if (notify) gli_sound_notify(sndid);
  };
  fire();
  return 1;
}
function gli_new_schan(rock, vol) {
  var schan = { rock: rock, disprock: undefined, volume: (vol === undefined ? 0x10000 : vol),
    audio: null, sndid: 0, repeats: 0, notify: false, paused: false, prev: null, next: gli_schannellist };
  if (schan.next) schan.next.prev = schan;
  gli_schannellist = schan;
  if (GiDispa) GiDispa.class_register('schannel', schan);
  else schan.disprock = gli_api_display_rocks++;
  return schan;
}
function gli_delete_schan(schan) {
  var prev = schan.prev, next = schan.next;
  gli_schan_stop(schan);
  if (prev) prev.next = next; else gli_schannellist = next;
  if (next) next.prev = prev;
  if (GiDispa) GiDispa.class_unregister('schannel', schan);
  schan.rock = 0;
}
function glk_schannel_create(rock) { return gli_new_schan(rock); }
function glk_schannel_create_ext(rock, vol) { return gli_new_schan(rock, vol); }
function glk_schannel_destroy(schan) {
  if (!schan) throw ('glk_schannel_destroy: invalid schannel');
  gli_delete_schan(schan);
}
function glk_schannel_play(schan, sndid) { return glk_schannel_play_ext(schan, sndid, 1, 0); }
function glk_schannel_play_ext(schan, sndid, repeats, notify) {
  if (!schan) throw ('glk_schannel_play_ext: invalid schannel');
  if (window.tqCfg && window.tqCfg.soundEnabled === false) return 0;
  return gli_schan_play(schan, sndid, repeats, notify);
}
function glk_schannel_stop(schan) {
  if (!schan) throw ('glk_schannel_stop: invalid schannel');
  gli_schan_stop(schan);
}
function glk_schannel_set_volume(schan, vol) {
  if (!schan) throw ('glk_schannel_set_volume: invalid schannel');
  schan.volume = vol;
  if (schan.audio) schan.audio.volume = gli_schan_volume(schan);
}
function glk_schannel_set_volume_ext(schan, vol, duration, notify) {
  if (!schan) throw ('glk_schannel_set_volume_ext: invalid schannel');
  glk_schannel_set_volume(schan, vol);
  if (duration > 0 && notify) setTimeout(function () { gli_sound_notify(0); }, duration);
}
function glk_sound_load_hint(sndid, flag) {}
function glk_schannel_play_multi(schans, sndids, notify) {
  if (!schans || !sndids) return 0;
  var n = Math.min(schans.length, sndids.length), ok = 0;
  for (var i = 0; i < n; i++) {
    if (schans[i]) ok += gli_schan_play(schans[i], sndids[i], 1, (notify && i === n - 1) ? 1 : 0);
  }
  return ok ? 1 : 0;
}
function glk_schannel_pause(schan) {
  if (!schan || !schan.audio) return;
  try { schan.audio.pause(); } catch (e) {}
  schan.paused = true;
}
function glk_schannel_unpause(schan) {
  if (!schan || !schan.audio || !schan.paused) return;
  schan.paused = false;
  try { var pr = schan.audio.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
}
function glk_set_hyperlink(val){gli_set_hyperlink(gli_currentstr,val);}
function glk_set_hyperlink_stream(str,val){gli_set_hyperlink(str,val);}
function glk_request_hyperlink_event(win){if(!win)
throw('glk_request_hyperlink_event: invalid window');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){win.hyperlink_request=true;}}
function glk_cancel_hyperlink_event(win){if(!win)
throw('glk_cancel_hyperlink_event: invalid window');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){win.hyperlink_request=false;}}
function glk_buffer_to_lower_case_uni(arr,numchars){var ix,jx,pos,val,origval;var arrlen=arr.length;var src=arr.slice(0,numchars);if(arrlen<numchars)
throw('buffer_to_lower_case_uni: numchars exceeds array length');pos=0;for(ix=0;ix<numchars;ix++){origval=src[ix];val=unicode_lower_table[origval];if(val===undefined){arr[pos]=origval;pos++;}
else if(!(val instanceof Array)){arr[pos]=val;pos++;}
else{for(jx=0;jx<val.length;jx++){arr[pos]=val[jx];pos++;}}}
arr.length=arrlen;return pos;}
function glk_buffer_to_upper_case_uni(arr,numchars){var ix,jx,pos,val,origval;var arrlen=arr.length;var src=arr.slice(0,numchars);if(arrlen<numchars)
throw('buffer_to_upper_case_uni: numchars exceeds array length');pos=0;for(ix=0;ix<numchars;ix++){origval=src[ix];val=unicode_upper_table[origval];if(val===undefined){arr[pos]=origval;pos++;}
else if(!(val instanceof Array)){arr[pos]=val;pos++;}
else{for(jx=0;jx<val.length;jx++){arr[pos]=val[jx];pos++;}}}
arr.length=arrlen;return pos;}
function glk_buffer_to_title_case_uni(arr,numchars,lowerrest){var ix,jx,pos,val,origval;var arrlen=arr.length;var src=arr.slice(0,numchars);if(arrlen<numchars)
throw('buffer_to_title_case_uni: numchars exceeds array length');pos=0;if(numchars==0)
return 0;ix=0;{origval=src[ix];val=unicode_title_table[origval];if(val===undefined){val=unicode_upper_table[origval];}
if(val===undefined){arr[pos]=origval;pos++;}
else if(!(val instanceof Array)){arr[pos]=val;pos++;}
else{for(jx=0;jx<val.length;jx++){arr[pos]=val[jx];pos++;}}}
if(!lowerrest){for(ix=1;ix<numchars;ix++){origval=src[ix];arr[pos]=origval;pos++;}}
else{for(ix=1;ix<numchars;ix++){origval=src[ix];val=unicode_lower_table[origval];if(val===undefined){arr[pos]=origval;pos++;}
else if(!(val instanceof Array)){arr[pos]=val;pos++;}
else{for(jx=0;jx<val.length;jx++){arr[pos]=val[jx];pos++;}}}}
arr.length=arrlen;return pos;}
function gli_buffer_canon_decompose_uni(arr,numchars){var src=arr.slice(0,numchars);var pos,ix,jx,origval,val;var grpstart,grpend,kx,tmp;pos=0;for(ix=0;ix<numchars;ix++){origval=src[ix];val=unicode_decomp_table[origval];if(val===undefined){arr[pos]=origval;pos++;}
else if(!(val instanceof Array)){arr[pos]=val;pos++;}
else{for(jx=0;jx<val.length;jx++){arr[pos]=val[jx];pos++;}}}
ix=0;while(ix<pos){if(!unicode_combin_table[arr[ix]]){ix++;continue;}
if(ix>=pos)
break;grpstart=ix;while(ix<pos&&unicode_combin_table[arr[ix]])
ix++;grpend=ix;if(grpend-grpstart>=2){for(jx=grpend-1;jx>grpstart;jx--){for(kx=grpstart;kx<jx;kx++){if(unicode_combin_table[arr[kx]]>unicode_combin_table[arr[kx+1]]){tmp=arr[kx];arr[kx]=arr[kx+1];arr[kx+1]=tmp;}}}}}
return pos;}
function gli_buffer_canon_compose_uni(arr,numchars){var ix,jx,curch,newch,curclass,newclass,map,pos;if(numchars==0)
return 0;pos=0;curch=arr[0];curclass=unicode_combin_table[curch];if(curclass)
curclass=999;ix=1;jx=ix;while(true){if(jx>=numchars){arr[pos]=curch;pos=ix;break;}
newch=arr[jx];newclass=unicode_combin_table[newch];map=unicode_compo_table[curch];if(map!==undefined&&map[newch]!==undefined&&(!curclass||(newclass&&curclass<newclass))){curch=map[newch];arr[pos]=curch;}
else{if(!newclass){pos=ix;curch=newch;}
curclass=newclass;arr[ix]=newch;ix++;}
jx++;}
return pos;}
function glk_buffer_canon_decompose_uni(arr,numchars){var arrlen=arr.length;var len;len=gli_buffer_canon_decompose_uni(arr,numchars);arr.length=arrlen;return len;}
function glk_buffer_canon_normalize_uni(arr,numchars){var arrlen=arr.length;var len;len=gli_buffer_canon_decompose_uni(arr,numchars);len=gli_buffer_canon_compose_uni(arr,len);arr.length=arrlen;return len;}
function glk_put_char_uni(ch){gli_put_char(gli_currentstr,ch);}
function glk_put_string_uni(val){glk_put_jstring_stream(gli_currentstr,val,false);}
function glk_put_buffer_uni(arr){gli_put_array(gli_currentstr,arr,false);}
function glk_put_char_stream_uni(str,ch){gli_put_char(str,ch);}
function glk_put_string_stream_uni(str,val){glk_put_jstring_stream(str,val,false);}
function glk_put_buffer_stream_uni(str,arr){gli_put_array(str,arr,false);}
function glk_get_char_stream_uni(str){if(!str)
throw('glk_get_char_stream_uni: invalid stream');return gli_get_char(str,true);}
function glk_get_buffer_stream_uni(str,buf){if(!str)
throw('glk_get_buffer_stream_uni: invalid stream');return gli_get_buffer(str,buf,true);}
function glk_get_line_stream_uni(str,buf){if(!str)
throw('glk_get_line_stream_uni: invalid stream');return gli_get_line(str,buf,true);}
function glk_stream_open_file_uni(fref,fmode,rock){var Dialog=GlkOte.getlibrary('Dialog');if(!fref)
throw('glk_stream_open_file_uni: invalid fileref');var str;var fstream;if(fmode!=Const.filemode_Read&&fmode!=Const.filemode_Write&&fmode!=Const.filemode_ReadWrite&&fmode!=Const.filemode_WriteAppend)
throw('glk_stream_open_file_uni: illegal filemode');if(fmode==Const.filemode_Read&&!Dialog.file_ref_exists(fref.ref))
return null;if(!Dialog.streaming){var content=null;if(fmode!=Const.filemode_Write){content=Dialog.file_read(fref.ref);}
if(content==null){content=[];if(fmode!=Const.filemode_Read){Dialog.file_write(fref.ref,'',true);}}
if(content.length==null)
throw('glk_stream_open_file_uni: data read had no length');}
else{fstream=Dialog.file_fopen(fmode,fref.ref);if(!fstream)
return null;}
str=gli_new_stream(strtype_File,(fmode!=Const.filemode_Write),(fmode!=Const.filemode_Read),rock);str.unicode=true;str.isbinary=!fref.textmode;str.ref=fref.ref;str.origfmode=fmode;if(!Dialog.streaming){str.streaming=false;str.buf=content;str.buflen=0xFFFFFFFF;if(fmode==Const.filemode_Write)
str.bufeof=0;else
str.bufeof=content.length;if(fmode==Const.filemode_WriteAppend)
str.bufpos=str.bufeof;else
str.bufpos=0;}
else{str.streaming=true;str.fstream=fstream;str.buffer4=fstream.BufferClass.alloc(4);}
return str;}
function glk_stream_open_memory_uni(buf,fmode,rock){var str;if(fmode!=Const.filemode_Read&&fmode!=Const.filemode_Write&&fmode!=Const.filemode_ReadWrite)
throw('glk_stream_open_memory: illegal filemode');str=gli_new_stream(strtype_Memory,(fmode!=Const.filemode_Write),(fmode!=Const.filemode_Read),rock);str.unicode=true;if(buf){str.buf=buf;str.buflen=buf.length;str.bufpos=0;if(fmode==Const.filemode_Write)
str.bufeof=0;else
str.bufeof=str.buflen;if(GiDispa)
GiDispa.retain_array(buf);}
return str;}
function glk_request_char_event_uni(win){if(!win)
throw('glk_request_char_event: invalid window');if(win.char_request||win.line_request)
throw('glk_request_char_event: window already has keyboard request');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){win.char_request=true;win.char_request_uni=true;win.input_generation=event_generation;}
else{throw('glk_request_char_event: window does not support keyboard input');}}
function glk_request_line_event_uni(win,buf,initlen){if(!win)
throw('glk_request_line_event: invalid window');if(win.char_request||win.line_request)
throw('glk_request_line_event: window already has keyboard request');if(win.type==Const.wintype_TextBuffer||win.type==Const.wintype_TextGrid){if(initlen){var ls=buf.slice(0,initlen);if(!current_partial_outputs)
current_partial_outputs={};current_partial_outputs[win.disprock]=UniArrayToString(ls);}
win.line_request=true;win.line_request_uni=true;if(win.type==Const.wintype_TextBuffer)
win.request_echo_line_input=win.echo_line_input;else
win.request_echo_line_input=true;win.input_generation=event_generation;win.linebuf=buf;if(GiDispa)
GiDispa.retain_array(buf);}
else{throw('glk_request_line_event: window does not support keyboard input');}}
function glk_current_time(timevalref){var now=new Date().getTime();var usec;timevalref.set_field(0,Math.floor(now/4294967296000));timevalref.set_field(1,Math.floor(now/1000)>>>0);usec=Math.floor((now%1000)*1000);if(usec<0)
usec=1000000+usec;timevalref.set_field(2,usec);}
function glk_current_simple_time(factor){var now=new Date().getTime();return Math.floor(now/(factor*1000));}
function glk_time_to_date_utc(timevalref,dateref){var now=timevalref.get_field(0)*4294967296000+timevalref.get_field(1)*1000+timevalref.get_field(2)/1000;var obj=new Date(now);dateref.set_field(0,obj.getUTCFullYear())
dateref.set_field(1,1+obj.getUTCMonth())
dateref.set_field(2,obj.getUTCDate())
dateref.set_field(3,obj.getUTCDay())
dateref.set_field(4,obj.getUTCHours())
dateref.set_field(5,obj.getUTCMinutes())
dateref.set_field(6,obj.getUTCSeconds())
dateref.set_field(7,1000*obj.getUTCMilliseconds())}
function glk_time_to_date_local(timevalref,dateref){var now=timevalref.get_field(0)*4294967296000+timevalref.get_field(1)*1000+timevalref.get_field(2)/1000;var obj=new Date(now);dateref.set_field(0,obj.getFullYear())
dateref.set_field(1,1+obj.getMonth())
dateref.set_field(2,obj.getDate())
dateref.set_field(3,obj.getDay())
dateref.set_field(4,obj.getHours())
dateref.set_field(5,obj.getMinutes())
dateref.set_field(6,obj.getSeconds())
dateref.set_field(7,1000*obj.getMilliseconds())}
function glk_simple_time_to_date_utc(time,factor,dateref){var now=time*(1000*factor);var obj=new Date(now);dateref.set_field(0,obj.getUTCFullYear())
dateref.set_field(1,1+obj.getUTCMonth())
dateref.set_field(2,obj.getUTCDate())
dateref.set_field(3,obj.getUTCDay())
dateref.set_field(4,obj.getUTCHours())
dateref.set_field(5,obj.getUTCMinutes())
dateref.set_field(6,obj.getUTCSeconds())
dateref.set_field(7,1000*obj.getUTCMilliseconds())}
function glk_simple_time_to_date_local(time,factor,dateref){var now=time*(1000*factor);var obj=new Date(now);dateref.set_field(0,obj.getFullYear())
dateref.set_field(1,1+obj.getMonth())
dateref.set_field(2,obj.getDate())
dateref.set_field(3,obj.getDay())
dateref.set_field(4,obj.getHours())
dateref.set_field(5,obj.getMinutes())
dateref.set_field(6,obj.getSeconds())
dateref.set_field(7,1000*obj.getMilliseconds())}
function glk_date_to_time_utc(dateref,timevalref){var obj=new Date(0);obj.setUTCFullYear(dateref.get_field(0));obj.setUTCMonth(dateref.get_field(1)-1);obj.setUTCDate(dateref.get_field(2));obj.setUTCHours(dateref.get_field(4));obj.setUTCMinutes(dateref.get_field(5));obj.setUTCSeconds(dateref.get_field(6));obj.setUTCMilliseconds(dateref.get_field(7)/1000);var now=obj.getTime();var usec;timevalref.set_field(0,Math.floor(now/4294967296000));timevalref.set_field(1,Math.floor(now/1000)>>>0);usec=Math.floor((now%1000)*1000);if(usec<0)
usec=1000000+usec;timevalref.set_field(2,usec);}
function glk_date_to_time_local(dateref,timevalref){var obj=new Date(dateref.get_field(0),dateref.get_field(1)-1,dateref.get_field(2),dateref.get_field(4),dateref.get_field(5),dateref.get_field(6),dateref.get_field(7)/1000);var now=obj.getTime();var usec;timevalref.set_field(0,Math.floor(now/4294967296000));timevalref.set_field(1,Math.floor(now/1000)>>>0);usec=Math.floor((now%1000)*1000);if(usec<0)
usec=1000000+usec;timevalref.set_field(2,usec);}
function glk_date_to_simple_time_utc(dateref,factor){var obj=new Date(0);obj.setUTCFullYear(dateref.get_field(0));obj.setUTCMonth(dateref.get_field(1)-1);obj.setUTCDate(dateref.get_field(2));obj.setUTCHours(dateref.get_field(4));obj.setUTCMinutes(dateref.get_field(5));obj.setUTCSeconds(dateref.get_field(6));obj.setUTCMilliseconds(dateref.get_field(7)/1000);var now=obj.getTime();return Math.floor(now/(factor*1000));}
function glk_date_to_simple_time_local(dateref,factor){var obj=new Date(dateref.get_field(0),dateref.get_field(1)-1,dateref.get_field(2),dateref.get_field(4),dateref.get_field(5),dateref.get_field(6),dateref.get_field(7)/1000);var now=obj.getTime();return Math.floor(now/(factor*1000));}
return{classname:'Glk',version:'2.3.7',init:init,inited:is_inited,update:update,getlibrary:get_library,save_allstate:save_allstate,restore_allstate:restore_allstate,fatal_error:fatal_error,byte_array_to_string:ByteArrayToString,uni_array_to_string:UniArrayToString,Const:Const,RefBox:RefBox,RefStruct:RefStruct,DidNotReturn:DidNotReturn,call_may_not_return:call_may_not_return,glk_put_jstring:glk_put_jstring,glk_put_jstring_stream:glk_put_jstring_stream,glk_exit:glk_exit,glk_tick:glk_tick,glk_gestalt:glk_gestalt,glk_gestalt_ext:glk_gestalt_ext,glk_window_iterate:glk_window_iterate,glk_window_get_rock:glk_window_get_rock,glk_window_get_root:glk_window_get_root,glk_window_open:glk_window_open,glk_window_close:glk_window_close,glk_window_get_size:glk_window_get_size,glk_window_set_arrangement:glk_window_set_arrangement,glk_window_get_arrangement:glk_window_get_arrangement,glk_window_get_type:glk_window_get_type,glk_window_get_parent:glk_window_get_parent,glk_window_clear:glk_window_clear,glk_window_move_cursor:glk_window_move_cursor,glk_window_get_stream:glk_window_get_stream,glk_window_set_echo_stream:glk_window_set_echo_stream,glk_window_get_echo_stream:glk_window_get_echo_stream,glk_set_window:glk_set_window,glk_window_get_sibling:glk_window_get_sibling,glk_stream_iterate:glk_stream_iterate,glk_stream_get_rock:glk_stream_get_rock,glk_stream_open_file:glk_stream_open_file,glk_stream_open_memory:glk_stream_open_memory,glk_stream_close:glk_stream_close,glk_stream_set_position:glk_stream_set_position,glk_stream_get_position:glk_stream_get_position,glk_stream_set_current:glk_stream_set_current,glk_stream_get_current:glk_stream_get_current,glk_fileref_create_temp:glk_fileref_create_temp,glk_fileref_create_by_name:glk_fileref_create_by_name,glk_fileref_create_by_prompt:glk_fileref_create_by_prompt,glk_fileref_destroy:glk_fileref_destroy,glk_fileref_iterate:glk_fileref_iterate,glk_fileref_get_rock:glk_fileref_get_rock,glk_fileref_delete_file:glk_fileref_delete_file,glk_fileref_does_file_exist:glk_fileref_does_file_exist,glk_fileref_create_from_fileref:glk_fileref_create_from_fileref,glk_put_char:glk_put_char,glk_put_char_stream:glk_put_char_stream,glk_put_string:glk_put_string,glk_put_string_stream:glk_put_string_stream,glk_put_buffer:glk_put_buffer,glk_put_buffer_stream:glk_put_buffer_stream,glk_set_style:glk_set_style,glk_set_style_stream:glk_set_style_stream,glk_get_char_stream:glk_get_char_stream,glk_get_line_stream:glk_get_line_stream,glk_get_buffer_stream:glk_get_buffer_stream,glk_char_to_lower:glk_char_to_lower,glk_char_to_upper:glk_char_to_upper,glk_stylehint_set:glk_stylehint_set,glk_stylehint_clear:glk_stylehint_clear,glk_style_distinguish:glk_style_distinguish,glk_style_measure:glk_style_measure,glk_select:glk_select,glk_select_poll:glk_select_poll,glk_request_line_event:glk_request_line_event,glk_cancel_line_event:glk_cancel_line_event,glk_request_char_event:glk_request_char_event,glk_cancel_char_event:glk_cancel_char_event,glk_request_mouse_event:glk_request_mouse_event,glk_cancel_mouse_event:glk_cancel_mouse_event,glk_request_timer_events:glk_request_timer_events,glk_image_get_info:glk_image_get_info,glk_image_draw:glk_image_draw,glk_image_draw_scaled:glk_image_draw_scaled,glk_image_draw_scaled_ext:glk_image_draw_scaled_ext,glk_window_flow_break:glk_window_flow_break,glk_window_erase_rect:glk_window_erase_rect,glk_window_fill_rect:glk_window_fill_rect,glk_window_set_background_color:glk_window_set_background_color,glk_schannel_iterate:glk_schannel_iterate,glk_schannel_get_rock:glk_schannel_get_rock,glk_schannel_create:glk_schannel_create,glk_schannel_destroy:glk_schannel_destroy,glk_schannel_play:glk_schannel_play,glk_schannel_play_ext:glk_schannel_play_ext,glk_schannel_stop:glk_schannel_stop,glk_schannel_set_volume:glk_schannel_set_volume,glk_schannel_create_ext:glk_schannel_create_ext,glk_schannel_play_multi:glk_schannel_play_multi,glk_schannel_pause:glk_schannel_pause,glk_schannel_unpause:glk_schannel_unpause,glk_schannel_set_volume_ext:glk_schannel_set_volume_ext,glk_sound_load_hint:glk_sound_load_hint,glk_set_hyperlink:glk_set_hyperlink,glk_set_hyperlink_stream:glk_set_hyperlink_stream,glk_request_hyperlink_event:glk_request_hyperlink_event,glk_cancel_hyperlink_event:glk_cancel_hyperlink_event,glk_buffer_to_lower_case_uni:glk_buffer_to_lower_case_uni,glk_buffer_to_upper_case_uni:glk_buffer_to_upper_case_uni,glk_buffer_to_title_case_uni:glk_buffer_to_title_case_uni,glk_buffer_canon_decompose_uni:glk_buffer_canon_decompose_uni,glk_buffer_canon_normalize_uni:glk_buffer_canon_normalize_uni,glk_put_char_uni:glk_put_char_uni,glk_put_string_uni:glk_put_string_uni,glk_put_buffer_uni:glk_put_buffer_uni,glk_put_char_stream_uni:glk_put_char_stream_uni,glk_put_string_stream_uni:glk_put_string_stream_uni,glk_put_buffer_stream_uni:glk_put_buffer_stream_uni,glk_get_char_stream_uni:glk_get_char_stream_uni,glk_get_buffer_stream_uni:glk_get_buffer_stream_uni,glk_get_line_stream_uni:glk_get_line_stream_uni,glk_stream_open_file_uni:glk_stream_open_file_uni,glk_stream_open_memory_uni:glk_stream_open_memory_uni,glk_request_char_event_uni:glk_request_char_event_uni,glk_request_line_event_uni:glk_request_line_event_uni,glk_set_echo_line_event:glk_set_echo_line_event,glk_set_terminators_line_event:glk_set_terminators_line_event,glk_current_time:glk_current_time,glk_current_simple_time:glk_current_simple_time,glk_time_to_date_utc:glk_time_to_date_utc,glk_time_to_date_local:glk_time_to_date_local,glk_simple_time_to_date_utc:glk_simple_time_to_date_utc,glk_simple_time_to_date_local:glk_simple_time_to_date_local,glk_date_to_time_utc:glk_date_to_time_utc,glk_date_to_time_local:glk_date_to_time_local,glk_date_to_simple_time_utc:glk_date_to_simple_time_utc,glk_date_to_simple_time_local:glk_date_to_simple_time_local,glk_stream_open_resource:glk_stream_open_resource,glk_stream_open_resource_uni:glk_stream_open_resource_uni};};var Glk=new GlkClass();try{exports.Glk=Glk;exports.GlkClass=GlkClass;}catch(ex){};

var QuixeClass=function(){var self={};function quixe_init(image,all_options){self.GiDispa=all_options.GiDispa;self.GiLoad=all_options.GiLoad;self.Glk=all_options.io;game_image=new Uint8Array(image);var ls=game_image.slice(0,64);var ix,val;for(ix=0;ix<ls.length;ix++){val=ls[ix].toString(16);if(val.length<2)
val="0"+val;ls[ix]=val;}
game_signature=ls.join('');if(all_options){opt_log_execution_time=all_options.log_execution_time;opt_rethrow_exceptions=all_options.rethrow_exceptions;opt_do_vm_autosave=all_options.do_vm_autosave;opt_clear_vm_autosave=all_options.clear_vm_autosave;}
if(all_options&&all_options.debug_info_chunk){parse_inform_debug_data();}}
function quixe_inited(){return(game_image!=null);}
function quixe_getlibrary(val){switch(val){case'GiDispa':return self.GiDispa;case'GiLoad':return self.GiLoad;case'Glk':return self.Glk;case'GlkOte':return self.Glk.getlibrary('GlkOte');case'Dialog':return self.Glk.getlibrary('Dialog');}
return null;}
function quixe_start(){if(self.vm_started){self.Glk.fatal_error("Quixe was inited twice!");return;}
try{setup_bytestring_table();setup_operandlist_table();setup_vm();execute_loop();}
catch(ex){if(ex.stack)
qlog('JS stack dump A:\n'+ex.stack);qstackdump();self.Glk.fatal_error("Quixe init: "+show_exception(ex));if(true||opt_rethrow_exceptions)
throw ex;}}
function quixe_resume(argument){try{self.done_executing=self.vm_stopped;execute_loop();}
catch(ex){if(ex.stack)
qlog('JS stack dump B:\n'+ex.stack);qstackdump();self.Glk.fatal_error("Quixe run: "+show_exception(ex));if(opt_rethrow_exceptions)
throw ex;}}
function show_exception(ex){if(typeof(ex)=='string')
return ex;var res=ex.toString();if(ex.message)
res=res+' '+ex.message;if(ex.fileName)
res=res+' '+ex.fileName;if(ex.lineNumber)
res=res+' line:'+ex.lineNumber;if(ex.name)
res=res+' '+ex.name;if(ex.number)
res=res+' '+ex.number;return res;}
function qlog(msg){if(window.console&&console.log)
console.log(msg);else if(window.opera&&opera.postError)
opera.postError(msg);}
function qobjdump(obj,depth){var key,proplist;if(jQuery.type(obj)==='array'){if(depth)
depth--;var ls=jQuery.map(obj,function(v,ix){return qobjdump(v,depth);});return("["+ls.join(",")+"]");}
if(!(jQuery.type(obj)==='object'))
return(""+obj);proplist=[];for(key in obj){var val=obj[key];if(depth&&jQuery.type(val)==='object')
val=qobjdump(val,depth-1);proplist.push(key+":"+val);}
return"{ "+proplist.join(", ")+" }";}
function qstackdump(){if(!stack||!stack.length)
return;var ix,val,debugfunc;var frm;var ls=[];for(ix=0;ix<stack.length;ix++){frm=stack[ix];if(!frm.vmfunc.funcaddr){ls.push("(anonymous)");continue;}
val="0x"+frm.vmfunc.funcaddr.toString(16);debugfunc=debuginfo.functionmap[frm.vmfunc.funcaddr];if(debugfunc)
val=val+(" \""+debugfunc.name+"\"");ls.push(val);}
qlog("VM stack dump: "+ls.join(", "));}
if(Math.imul===undefined){qlog("Polyfilling Math.imul().");Math.imul=function(a,b){var ah=(a>>>16)&0xffff;var al=a&0xffff;var bh=(b>>>16)&0xffff;var bl=b&0xffff;return((al*bl)+(((ah*bl+al*bh)<<16)>>>0)|0);};}
var bytestring_table=Array(256);var quotechar_table=Array(256);function setup_bytestring_table(){var ix,val;for(ix=0;ix<0x100;ix++){val=ix.toString(16);if(ix<0x10)
val="0"+val;bytestring_table[ix]=val;}
for(ix=0;ix<0x100;ix++){if(ix>=0x20&&ix<0x7f){if(ix==0x22||ix==0x27||ix==0x5c)
val="\\"+String.fromCharCode(ix);else
val=String.fromCharCode(ix);}
else if(ix==0x0a){val="\\n";}
else{val="\\x"+bytestring_table[ix];}
quotechar_table[ix]=val;}}
function ByteRead4(arr,addr){return(arr[addr]*0x1000000)+(arr[addr+1]*0x10000)
+(arr[addr+2]*0x100)+(arr[addr+3]);}
function ByteRead2(arr,addr){return(arr[addr]*0x100)+(arr[addr+1]);}
function ByteRead1(arr,addr){return arr[addr];}
function Mem1(addr){return memmap[addr];}
function Mem2(addr){return(memmap[addr]*0x100)+(memmap[addr+1]);}
function Mem4(addr){return(memmap[addr]*0x1000000)+(memmap[addr+1]*0x10000)
+(memmap[addr+2]*0x100)+(memmap[addr+3]);}
function MemSlice(addr,length){return memmap.slice(addr,addr+length);}
function MemW1(addr,val){memmap[addr]=val;}
function MemW2(addr,val){memmap[addr]=(val>>8);memmap[addr+1]=val;}
function MemW4(addr,val){memmap[addr]=(val>>24);memmap[addr+1]=(val>>16);memmap[addr+2]=(val>>8);memmap[addr+3]=val;}
self.Mem1=Mem1;self.Mem2=Mem2;self.Mem4=Mem4;self.MemSlice=MemSlice;self.MemW1=MemW1;self.MemW2=MemW2;self.MemW4=MemW4;function BytePushString(arr,str){for(var ix=0;ix<str.length;ix++){arr.push(str.charCodeAt(ix));}}
function BytePush4(arr,val){arr.push((val>>24)&0xFF);arr.push((val>>16)&0xFF);arr.push((val>>8)&0xFF);arr.push(val&0xFF);}
function BytePush2(arr,val){arr.push((val>>8)&0xFF);arr.push(val&0xFF);}
function BytePush1(arr,val){arr.push(val&0xFF);}
function ByteWrite4(arr,addr,val){arr[addr]=(val>>24)&0xFF;arr[addr+1]=(val>>16)&0xFF;arr[addr+2]=(val>>8)&0xFF;arr[addr+3]=val&0xFF;}
function ByteReadString(arr,addr,len){return String.fromCharCode.apply(this,arr.slice(addr,addr+len));}
function QuoteMem1(addr){if(memmap[addr]>=0x80)
return"0xffffff"+bytestring_table[memmap[addr]];return"0x"+bytestring_table[memmap[addr]];}
function QuoteMem2(addr){if(memmap[addr]>=0x80)
return"0xffff"+bytestring_table[memmap[addr]]+bytestring_table[memmap[addr+1]];if(memmap[addr])
return"0x"+bytestring_table[memmap[addr]]+bytestring_table[memmap[addr+1]];return"0x"+bytestring_table[memmap[addr+1]];}
function QuoteMem4(addr){if(memmap[addr])
return"0x"+bytestring_table[memmap[addr]]+bytestring_table[memmap[addr+1]]+bytestring_table[memmap[addr+2]]+bytestring_table[memmap[addr+3]];if(memmap[addr+1])
return"0x"+bytestring_table[memmap[addr+1]]+bytestring_table[memmap[addr+2]]+bytestring_table[memmap[addr+3]];if(memmap[addr+2])
return"0x"+bytestring_table[memmap[addr+2]]+bytestring_table[memmap[addr+3]];return"0x"+bytestring_table[memmap[addr+3]];}
function ReadArgByte(addr){if(addr==0xffffffff)
return self.frame.valstack.pop()&0xFF;else
return Mem1(addr);}
function WriteArgByte(addr,val){if(addr==0xffffffff)
self.frame.valstack.push(val&0xFF);else
MemW1(addr,val);}
function ReadArgWord(addr){if(addr==0xffffffff)
return self.frame.valstack.pop();else
return Mem4(addr);}
function WriteArgWord(addr,val){if(addr==0xffffffff)
self.frame.valstack.push(val);else
MemW4(addr,val);}
function ReadStructField(addr,fieldnum){if(addr==0xffffffff)
return self.frame.valstack.pop();else
return Mem4(addr+4*fieldnum);}
function WriteStructField(addr,fieldnum,val){if(addr==0xffffffff)
self.frame.valstack.push(val);else
MemW4(addr+4*fieldnum,val);}
function SetResumeStore(val){self.resumevalue=val;}
function CharToString(val){if(val<0x10000){return String.fromCharCode(val);}
else{val-=0x10000;return String.fromCharCode(0xD800+(val>>10),0xDC00+(val&0x3FF));}}
function QuoteCharToString(val){if(val<0x100){return quotechar_table[val];}
else if(val<0x10000){val=val.toString(16);while(val.length<4)
val="0"+val;return("\\u"+val);}
else{var val2;val-=0x10000;val2=0xD800+(val>>10);val=0xDC00+(val&0x3FF);return("\\u"+val2.toString(16)+"\\u"+val.toString(16));}}
function QuoteStr1ToString(val){return QuoteCharToString(val.charCodeAt(0));}
var regexp_string_unsafe=/[^a-zA-Z0-9 .,;:?!=_+()-]/g;function QuoteEscapeString(val){val=val.replace(regexp_string_unsafe,QuoteStr1ToString);return'"'+val+'"';}
function fatal_error(msg){var ix,val;if(arguments.length>1){msg+=" (";for(ix=1;ix<arguments.length;ix++){val=arguments[ix];if(typeof(val)=='number'){val=val.toString(16);}
else{val=""+val;}
if(ix!=1)
msg+=" ";msg+=val;}
msg+=")";}
qlog(msg);throw(new Error(msg));}
self.fatal_error=fatal_error;function make_code(val,funcname,arg1,arg2){var func;if(funcname===undefined)
funcname='_func';if(arg1===undefined)
func=new Function('self',val);else if(arg2===undefined)
func=new Function('self',arg1,val);else
func=new Function('self',arg1,arg2,val);return func;}
function VMFunc(funcaddr,startpc,localsformat,rawformat){if(!funcaddr){this.funcaddr=null;this.startpc=null;this.functype=null;}
else{this.funcaddr=funcaddr;this.startpc=startpc;this.functype=Mem1(funcaddr);}
this.pathaddrs={};this[0]={};this[1]={};this[2]={};this.locallen=null;this.localsformat=localsformat;this.rawformat=rawformat;this.localsindex=[];var ix,jx;var locallen=0;for(ix=0;ix<this.localsformat.length;ix++){var form=this.localsformat[ix];if(form.size==4){while(locallen&3)
locallen++;}
else if(form.size==2){while(locallen&1)
locallen++;}
for(jx=0;jx<form.count;jx++){this.localsindex.push({size:form.size,pos:locallen});locallen+=form.size;}}
while(locallen&3)
locallen++;this.locallen=locallen;}
function StackFrame(vmfunc){var ix;this.vmfunc=vmfunc;this.depth=null;this.framestart=null;this.framelen=null;this.valstack=[];this.localspos=null;this.localsindex=vmfunc.localsindex;this.locals=[];for(ix=0;ix<this.localsindex.length;ix++){var form=this.localsindex[ix];this.locals[form.pos]=0;}
this.framelen=8+vmfunc.rawformat.length+vmfunc.locallen;}
function clone_stackframe(frame){var other=new StackFrame(frame.vmfunc);other.depth=frame.depth;other.framestart=frame.framestart;other.framelen=frame.framelen;other.valstack=frame.valstack.slice(0);other.localspos=frame.localspos;other.locals=frame.locals.slice(0);other.framelen=frame.framelen;return other;}
function push_serialized_stackframe(frame,arr){BytePush4(arr,frame.framelen);var rawformat=frame.vmfunc.rawformat;BytePush4(arr,8+rawformat.length);for(var i=0;i<rawformat.length;i++){arr.push(rawformat[i]);}
for(var i=0;i<frame.vmfunc.localsindex.length;i++){var form=frame.vmfunc.localsindex[i];if(form.size==4){while(arr.length&3)
arr.push(0);BytePush4(arr,frame.locals[form.pos]);}
else if(form.size==2){while(arr.length&1)
arr.push(0);BytePush2(arr,frame.locals[form.pos]);}
else{BytePush1(arr,frame.locals[form.pos]);}}
while(arr.length&3)
arr.push(0);for(var i=0;i<frame.valstack.length;i++){BytePush4(arr,frame.valstack[i]);}}
function pop_deserialized_stackframe(arr){var frameptr=ByteRead4(arr,arr.length-4);if(frameptr<0||frameptr>=arr.length){qlog("Bad frameptr in serialized stack frame");return undefined;}
arr=arr.splice(frameptr,arr.length);var framelen=ByteRead4(arr,0);var localspos=ByteRead4(arr,4);var rawformat=arr.slice(8,localspos);var localsformat=[];var addr=8;while(1){var loctype=ByteRead1(arr,addr);addr++;var locnum=ByteRead1(arr,addr);addr++;if(loctype==0){break;}
if(loctype!=1&&loctype!=2&&loctype!=4){fatal_error("Invalid local variable size in function header.",loctype);}
localsformat.push({size:loctype,count:locnum});}
var vmfunc=new VMFunc(null,null,localsformat,rawformat);var frame=new StackFrame(vmfunc);frame.framestart=frameptr;for(var i=0;i<frame.vmfunc.localsindex.length;i++){var form=frame.vmfunc.localsindex[i];if(form.size==4){frame.locals[form.pos]=ByteRead4(arr,localspos+form.pos);}
else if(form.size==2){frame.locals[form.pos]=ByteRead2(arr,localspos+form.pos);}
else{frame.locals[form.pos]=ByteRead1(arr,localspos+form.pos);}}
for(var pos=framelen;pos<arr.length;pos+=4){frame.valstack.push(ByteRead4(arr,pos));}
return frame;}
function VMTextEnv(addr,dectab){if(addr==0)
fatal_error("Tried to create a VMTextEnv for address zero.");this.addr=addr;this.cacheable=(dectab!==undefined);this.decoding_tree=dectab;this.vmstring_tables=[];if(this.cacheable){this.vmstring_tables[0]={};this.vmstring_tables[1]={};this.vmstring_tables[2]={};}}
var operandlist_table=null;function setup_operandlist_table(){function OperandList(formlist,argsize){this.argsize=(argsize?argsize:4);this.numops=formlist.length;var ls=[];for(var ix=0;ix<formlist.length;ix++)
ls.push(formlist.charAt(ix));this.formlist=ls;}
var list_none=new OperandList("");var list_L=new OperandList("L");var list_LL=new OperandList("LL");var list_LLL=new OperandList("LLL");var list_LLLL=new OperandList("LLLL");var list_LLLLL=new OperandList("LLLLL");var list_LLLLLLL=new OperandList("LLLLLLL");var list_LS=new OperandList("LS");var list_LLS=new OperandList("LLS");var list_LLLLLLS=new OperandList("LLLLLLS");var list_LLLLLLLS=new OperandList("LLLLLLLS");var list_LSS=new OperandList("LSS");var list_LLSS=new OperandList("LLSS");var list_LLLLSS=new OperandList("LLLLSS");var list_LC=new OperandList("LC");var list_LLC=new OperandList("LLC");var list_LLLC=new OperandList("LLLC");var list_LLLLC=new OperandList("LLLLC");var list_ES=new OperandList("ES");var list_LES=new OperandList("LES");var list_EES=new OperandList("EES");var list_F=new OperandList("F");var list_LF=new OperandList("LF");var list_LLF=new OperandList("LLF");var list_EF=new OperandList("EF");var list_1EF=new OperandList("EF",1);var list_2EF=new OperandList("EF",2);var list_S=new OperandList("S");var list_SS=new OperandList("SS");var list_CL=new OperandList("CL");var list_C=new OperandList("C");operandlist_table={0x00:list_none,0x10:list_EES,0x11:list_LES,0x12:list_LLS,0x13:list_LLS,0x14:list_LLS,0x15:list_ES,0x18:list_EES,0x19:list_EES,0x1A:list_EES,0x1B:list_ES,0x1C:list_LLS,0x1D:list_LLS,0x1E:list_LLS,0x20:list_L,0x22:list_LL,0x23:list_LL,0x24:list_LLL,0x25:list_LLL,0x26:list_LLL,0x27:list_LLL,0x28:list_LLL,0x29:list_LLL,0x2A:list_LLL,0x2B:list_LLL,0x2C:list_LLL,0x2D:list_LLL,0x30:list_LLC,0x31:list_L,0x32:list_CL,0x33:list_LL,0x34:list_LL,0x40:list_EF,0x41:list_2EF,0x42:list_1EF,0x44:list_LS,0x45:list_LS,0x48:list_LLS,0x49:list_LLS,0x4A:list_LLS,0x4B:list_LLS,0x4C:list_LLL,0x4D:list_LLL,0x4E:list_LLL,0x4F:list_LLL,0x50:list_F,0x51:list_LF,0x52:list_none,0x53:list_LL,0x54:list_L,0x70:list_L,0x71:list_L,0x72:list_L,0x73:list_L,0x100:list_LLS,0x101:list_L,0x102:list_S,0x103:list_LS,0x104:list_L,0x110:list_LS,0x111:list_L,0x120:list_none,0x121:list_S,0x122:list_none,0x123:list_LC,0x124:list_LF,0x125:list_C,0x126:list_F,0x127:list_LL,0x128:list_S,0x129:list_none,0x130:list_LLF,0x140:list_S,0x141:list_L,0x148:list_SS,0x149:list_LL,0x150:list_LLLLLLLS,0x151:list_LLLLLLLS,0x152:list_LLLLLLS,0x160:list_LC,0x161:list_LLC,0x162:list_LLLC,0x163:list_LLLLC,0x170:list_LL,0x171:list_LLL,0x178:list_LS,0x179:list_L,0x180:list_LL,0x181:list_LL,0x190:list_LS,0x191:list_LS,0x192:list_LS,0x198:list_LS,0x199:list_LS,0x1A0:list_LLS,0x1A1:list_LLS,0x1A2:list_LLS,0x1A3:list_LLS,0x1A4:list_LLSS,0x1A8:list_LS,0x1A9:list_LS,0x1AA:list_LS,0x1AB:list_LLS,0x1B0:list_LS,0x1B1:list_LS,0x1B2:list_LS,0x1B3:list_LS,0x1B4:list_LS,0x1B5:list_LS,0x1B6:list_LLS,0x1C0:list_LLLL,0x1C1:list_LLLL,0x1C2:list_LLL,0x1C3:list_LLL,0x1C4:list_LLL,0x1C5:list_LLL,0x1C8:list_LL,0x1C9:list_LL,0x200:list_LSS,0x201:list_LLS,0x202:list_LLS,0x203:list_LSS,0x204:list_LLS,0x208:list_LLSS,0x209:list_LLSS,0x210:list_LLLLSS,0x211:list_LLLLSS,0x212:list_LLLLSS,0x213:list_LLLLSS,0x214:list_LLLLSS,0x215:list_LLLLSS,0x218:list_LLSS,0x219:list_LLSS,0x21A:list_LLSS,0x21B:list_LLLLSS,0x220:list_LLSS,0x221:list_LLSS,0x222:list_LLSS,0x223:list_LLSS,0x224:list_LLSS,0x225:list_LLSS,0x226:list_LLLLSS,0x230:list_LLLLLLL,0x231:list_LLLLLLL,0x232:list_LLLLL,0x233:list_LLLLL,0x234:list_LLLLL,0x235:list_LLLLL,0x238:list_LLL,0x239:list_LLL}}
self.funcop_cache={};function oputil_record_funcop(funcop){if(funcop.mode==0){return"null";}
var key="m"+funcop.mode;if(funcop.argsize!=null)
key=key+"s"+funcop.argsize;if(funcop.addr!=null)
key=key+"a"+funcop.addr;if(self.funcop_cache.key)
return"self.funcop_cache."+key;var obj={key:key,mode:funcop.mode,argsize:funcop.argsize,addr:funcop.addr};self.funcop_cache[key]=obj;return"self.funcop_cache."+key;}
function oputil_store(context,funcop,operand){var holdvar;switch(funcop.mode){case 8:if(funcop.argsize==4){var opchar=operand[0];if(opchar==="0"){context.offstack.push(operand);return;}
if(opchar==="_"){push_offstack_holdvar(context,operand);return;}}
holdvar=alloc_holdvar(context,true);context.offstack.push(holdvar);if(funcop.argsize==4){context.code.push(holdvar+"=("+operand+");");}
else if(funcop.argsize==2){context.code.push(holdvar+"=0xffff&("+operand+");");}
else{context.code.push(holdvar+"=0xff&("+operand+");");}
return;case 0:context.code.push("("+operand+");");return;case 11:if(funcop.argsize==4){var opchar=operand[0];if(opchar==="0"){store_offloc_value(context,funcop.addr,operand,false);return;}
if(opchar==="_"){store_offloc_value(context,funcop.addr,operand,true);return;}}
store_offloc_value(context,funcop.addr,undefined);if(funcop.argsize==4){context.code.push("self.frame.locals["+funcop.addr+"]=("+operand+");");}
else if(funcop.argsize==2){context.code.push("self.frame.locals["+funcop.addr+"]=(0xffff &"+operand+");");}
else{context.code.push("self.frame.locals["+funcop.addr+"]=(0xff &"+operand+");");}
return;case 15:if(funcop.argsize==4){context.code.push("self.MemW4("+funcop.addr+","+operand+");");}
else if(funcop.argsize==2){context.code.push("self.MemW2("+funcop.addr+","+operand+");");}
else{context.code.push("self.MemW1("+funcop.addr+","+operand+");");}
return;default:fatal_error("Unknown addressing mode in store func operand.");}}
function oputil_push_callstub(context,operand,addr){if(addr===undefined)
addr=context.cp;context.code.push("self.frame.valstack.push("+operand+","+addr+",self.frame.framestart);");}
function oputil_push_substring_callstub(context){context.code.push("if (!substring) { substring=true;");context.code.push("self.frame.valstack.push(0x11,0,nextcp,self.frame.framestart);");context.code.push("}");}
function oputil_unload_offstate(context,keepstack){var ix;if(context.offstack.length){context.code.push("self.frame.valstack.push("+context.offstack.join(",")+");");}
if(context.offloc.length){for(ix=0;ix<context.offloc.length;ix++){if(context.offloc[ix]!==undefined&&context.offlocdirty[ix]){context.code.push("self.frame.locals["+ix+"]="+context.offloc[ix]+";");}}}
if(!keepstack){var holdvar;for(ix=0;ix<context.offloc.length;ix++){holdvar=context.offloc[ix];if(holdvar!==undefined){if(context.holduse[holdvar]!==undefined)
context.holduse[holdvar]=false;}}
context.offloc.length=0;context.offlocdirty.length=0;while(context.offstack.length){holdvar=context.offstack.pop();if(context.holduse[holdvar]!==undefined)
context.holduse[holdvar]=false;}}}
function oputil_flush_string(context){if(context.buffer.length==0)
return;var str=context.buffer.join("");context.buffer.length=0;if(str.length==0)
return;context.code.push("self.Glk.glk_put_jstring("+QuoteEscapeString(str)+");");}
function oputil_signify_operand(context,operand,hold){var val;if(quot_isconstant(operand)){val=Number(operand);if(val&0x80000000)
return""+(val-0x100000000);else
return operand;}
val="("+operand+"&0xffffffff)";if(hold){var holdvar=alloc_holdvar(context);context.code.push(holdvar+"="+val+";");return holdvar;}
else{return val;}}
function oputil_decode_float(context,operand,hold){var val;if(quot_isconstant(operand)){val=Number(operand);if(val==0x80000000)
return"-0";return""+decode_float(val);}
val="self.decode_float("+operand+")";if(hold){var holdvar=alloc_holdvar(context);context.code.push(holdvar+"="+val+";");return holdvar;}
else{return val;}}
function oputil_decode_double(context,ophi,oplo,hold){var val,valhi,vallo;if(quot_isconstant(ophi)&&quot_isconstant(oplo)){valhi=Number(ophi);vallo=Number(oplo);if(valhi==0x80000000&&vallo==0x0)
return"-0";return""+decode_double(valhi,vallo);}
val="self.decode_double("+ophi+","+oplo+")";if(hold){var holdvar=alloc_holdvar(context);context.code.push(holdvar+"="+val+";");return holdvar;}
else{return val;}}
function oputil_perform_jump(context,operand,unconditional){if(quot_isconstant(operand)){var val=Number(operand);if(val==0||val==1){if(unconditional){context.offstack.length=0;context.offloc.length=0;context.offlocdirty.length=0;}
else{}
context.code.push("if (self.leave_function()) return self.VMStopped;");context.code.push("self.pop_callstub("+val+");");}
else{oputil_unload_offstate(context,!unconditional);var newpc=(context.cp+val-2)>>>0;context.code.push("self.pc = "+newpc+";");context.vmfunc.pathaddrs[newpc]=true;}}
else{oputil_unload_offstate(context,!unconditional);context.code.push("if (("+operand+")==0 || ("+operand+")==1) {");context.code.push("if (self.leave_function()) return self.VMStopped;");context.code.push("self.pop_callstub("+operand+");");context.code.push("}");context.code.push("else {");context.code.push("self.pc = ("+context.cp+"+("+operand+")-2) >>>0;");context.code.push("}");}
context.code.push("return;");}
var opcode_table={0x0:function(context,operands){},0x10:function(context,operands){context.code.push(operands[2]+"(("+operands[0]+")+("+operands[1]+")) >>>0);");},0x11:function(context,operands){context.code.push(operands[2]+"(("+operands[0]+")-("+operands[1]+")) >>>0);");},0x12:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);context.code.push(operands[2]+"(Math.imul(("+sign0+"),("+sign1+"))) >>>0);");},0x13:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);var holdvar=alloc_holdvar(context);context.code.push(holdvar+"=(("+sign0+")/("+sign1+"));");context.code.push("if (!isFinite("+holdvar+")) self.fatal_error('Division by zero.');");context.code.push(operands[2]+"("+holdvar+">=0)?Math.floor("+holdvar+"):(-Math.floor(-"+holdvar+") >>>0));");},0x14:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);var holdvar=alloc_holdvar(context);context.code.push(holdvar+"=(("+sign0+")%("+sign1+"));");context.code.push("if (!isFinite("+holdvar+")) self.fatal_error('Modulo division by zero.');");context.code.push(operands[2]+holdvar+" >>>0);");},0x15:function(context,operands){context.code.push(operands[1]+"(-("+operands[0]+")) >>>0);");},0x18:function(context,operands){context.code.push(operands[2]+"(("+operands[0]+")&("+operands[1]+")) >>>0);");},0x19:function(context,operands){context.code.push(operands[2]+"(("+operands[0]+")|("+operands[1]+")) >>>0);");},0x1a:function(context,operands){context.code.push(operands[2]+"(("+operands[0]+")^("+operands[1]+")) >>>0);");},0x1b:function(context,operands){context.code.push(operands[1]+"(~("+operands[0]+")) >>>0);");},0x1c:function(context,operands){if(quot_isconstant(operands[1])){var val=Number(operands[1]);if(val<32)
context.code.push(operands[2]+"(("+operands[0]+")<<"+val+") >>>0);");else
context.code.push(operands[2]+"0);");}
else{context.code.push(operands[2]+"("+operands[1]+"<32) ? (("+operands[0]+"<<"+operands[1]+") >>>0) : 0);");}},0x1d:function(context,operands){if(quot_isconstant(operands[1])){var val=Number(operands[1]);if(val<32)
context.code.push(operands[2]+"(("+operands[0]+")>>"+val+") >>>0);");else
context.code.push(operands[2]+"(("+operands[0]+")&0x80000000) ? 0xffffffff : 0);");}
else{context.code.push("if ("+operands[0]+" & 0x80000000) {");context.code.push(operands[2]+"("+operands[1]+"<32) ? (("+operands[0]+">>"+operands[1]+") >>>0) : 0xffffffff);");context.code.push("} else {");context.code.push(operands[2]+"("+operands[1]+"<32) ? (("+operands[0]+">>"+operands[1]+") >>>0) : 0);");context.code.push("}");}},0x1e:function(context,operands){if(quot_isconstant(operands[1])){var val=Number(operands[1]);if(val<32)
context.code.push(operands[2]+"("+operands[0]+")>>>"+val+");");else
context.code.push(operands[2]+"0);");}
else{context.code.push(operands[2]+"("+operands[1]+"<32) ? ("+operands[0]+">>>"+operands[1]+") : 0);");}},0x20:function(context,operands){oputil_perform_jump(context,operands[0],true);context.path_ends=true;},0x104:function(context,operands){if(quot_isconstant(operands[0])){var newpc=Number(operands[0]);context.code.push("self.pc = "+newpc+";");context.vmfunc.pathaddrs[newpc]=true;}
else{context.code.push("self.pc = "+operands[0]+";");}
oputil_unload_offstate(context);context.code.push("return;");context.path_ends=true;},0x22:function(context,operands){context.code.push("if (("+operands[0]+")==0) {");oputil_perform_jump(context,operands[1]);context.code.push("}");},0x23:function(context,operands){context.code.push("if (("+operands[0]+")!=0) {");oputil_perform_jump(context,operands[1]);context.code.push("}");},0x24:function(context,operands){context.code.push("if (("+operands[0]+")==("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x25:function(context,operands){context.code.push("if (("+operands[0]+")!=("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x26:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);context.code.push("if (("+sign0+")<("+sign1+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x27:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);context.code.push("if (("+sign0+")>=("+sign1+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x28:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);context.code.push("if (("+sign0+")>("+sign1+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x29:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);var sign1=oputil_signify_operand(context,operands[1]);context.code.push("if (("+sign0+")<=("+sign1+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x2a:function(context,operands){context.code.push("if (("+operands[0]+")<("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x2b:function(context,operands){context.code.push("if (("+operands[0]+")>=("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x2c:function(context,operands){context.code.push("if (("+operands[0]+")>("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x2d:function(context,operands){context.code.push("if (("+operands[0]+")<=("+operands[1]+")) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x30:function(context,operands){if(quot_isconstant(operands[1])){var ix;var argc=Number(operands[1]);for(ix=0;ix<argc;ix++){if(context.offstack.length){var holdvar=pop_offstack_holdvar(context);context.code.push("self.tempcallargs["+ix+"]="+holdvar+";");}
else{context.code.push("self.tempcallargs["+ix+"]=self.frame.valstack.pop();");}}
oputil_unload_offstate(context);}
else{context.varsused["ix"]=true;oputil_unload_offstate(context);context.code.push("for (ix=0; ix<"+operands[1]+"; ix++) { self.tempcallargs[ix]=self.frame.valstack.pop(); }");}
oputil_push_callstub(context,operands[2]);context.code.push("self.enter_function("+operands[0]+", "+operands[1]+");");context.code.push("return;");context.path_ends=true;},0x34:function(context,operands){if(quot_isconstant(operands[1])){var ix;var argc=Number(operands[1]);for(ix=0;ix<argc;ix++){if(context.offstack.length){var holdvar=pop_offstack_holdvar(context);context.code.push("self.tempcallargs["+ix+"]="+holdvar+";");}
else{context.code.push("self.tempcallargs["+ix+"]=self.frame.valstack.pop();");}}
oputil_unload_offstate(context);}
else{context.varsused["ix"]=true;oputil_unload_offstate(context);context.code.push("for (ix=0; ix<"+operands[1]+"; ix++) { self.tempcallargs[ix]=self.frame.valstack.pop(); }");}
context.code.push("if (self.leave_function()) return self.VMStopped;");context.code.push("self.enter_function("+operands[0]+", "+operands[1]+");");context.code.push("return;");context.path_ends=true;},0x160:function(context,operands){oputil_unload_offstate(context);oputil_push_callstub(context,operands[1]);context.code.push("self.enter_function("+operands[0]+", 0);");context.code.push("return;");context.path_ends=true;},0x161:function(context,operands){oputil_unload_offstate(context);context.code.push("self.tempcallargs[0]=("+operands[1]+");");oputil_push_callstub(context,operands[2]);context.code.push("self.enter_function("+operands[0]+", 1);");context.code.push("return;");context.path_ends=true;},0x162:function(context,operands){oputil_unload_offstate(context);context.code.push("self.tempcallargs[0]=("+operands[1]+");");context.code.push("self.tempcallargs[1]=("+operands[2]+");");oputil_push_callstub(context,operands[3]);context.code.push("self.enter_function("+operands[0]+", 2);");context.code.push("return;");context.path_ends=true;},0x163:function(context,operands){oputil_unload_offstate(context);context.code.push("self.tempcallargs[0]=("+operands[1]+");");context.code.push("self.tempcallargs[1]=("+operands[2]+");");context.code.push("self.tempcallargs[2]=("+operands[3]+");");oputil_push_callstub(context,operands[4]);context.code.push("self.enter_function("+operands[0]+", 3);");context.code.push("return;");context.path_ends=true;},0x31:function(context,operands){context.offstack.length=0;context.offloc.length=0;context.offlocdirty.length=0;context.code.push("if (self.leave_function()) return self.VMStopped;");context.code.push("self.pop_callstub("+operands[0]+");");context.code.push("return;");context.path_ends=true;},0x32:function(context,operands){oputil_unload_offstate(context);oputil_push_callstub(context,operands[0]);context.code.push("self.store_operand("+operands[0]+",self.frame.framestart+self.frame.framelen+4*self.frame.valstack.length);");oputil_perform_jump(context,operands[1],true);context.path_ends=true;},0x33:function(context,operands){context.offstack.length=0;context.offloc.length=0;context.offlocdirty.length=0;context.code.push("self.pop_stack_to("+operands[1]+");");context.code.push("self.pop_callstub("+operands[0]+");");context.code.push("return;");context.path_ends=true;},0x40:function(context,operands){oputil_store(context,operands[1],operands[0]);},0x41:function(context,operands){oputil_store(context,operands[1],operands[0]);},0x42:function(context,operands){oputil_store(context,operands[1],operands[0]);},0x44:function(context,operands){var val;if(quot_isconstant(operands[0])){val=Number(operands[0]);val=(val&0x8000)?((val|0xffff0000)>>>0):(val&0xffff);context.code.push(operands[1]+val+");");}
else{context.code.push(operands[1]+"("+operands[0]+" & 0x8000) ? (("+operands[0]+" | 0xffff0000) >>> 0) : ("+operands[0]+" & 0xffff));");}},0x45:function(context,operands){var val;if(quot_isconstant(operands[0])){val=Number(operands[0]);val=(val&0x80)?((val|0xffffff00)>>>0):(val&0xff);context.code.push(operands[1]+val+");");}
else{context.code.push(operands[1]+"("+operands[0]+" & 0x80) ? (("+operands[0]+" | 0xffffff00) >>> 0) : ("+operands[0]+" & 0xff));");}},0x48:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1])*4;val="self.Mem4("+(addr>>>0)+")";}
else{var addr=Number(operands[1])*4;if(addr)
val="self.Mem4(("+operands[0]+"+"+addr+") >>>0)";else
val="self.Mem4("+operands[0]+")";}}
else{val="self.Mem4(("+operands[0]+"+4*"+operands[1]+") >>>0)";}
context.code.push(operands[2]+val+");");},0x49:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1])*2;val="self.Mem2("+(addr>>>0)+")";}
else{var addr=Number(operands[1])*2;if(addr)
val="self.Mem2(("+operands[0]+"+"+addr+") >>>0)";else
val="self.Mem2("+operands[0]+")";}}
else{val="self.Mem2(("+operands[0]+"+2*"+operands[1]+") >>>0)";}
context.code.push(operands[2]+val+");");},0x4a:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1]);val="self.Mem1("+(addr>>>0)+")";}
else{var addr=Number(operands[1]);if(addr)
val="self.Mem1(("+operands[0]+"+"+addr+") >>>0)";else
val="self.Mem1("+operands[0]+")";}}
else{val="self.Mem1(("+operands[0]+"+"+operands[1]+") >>>0)";}
context.code.push(operands[2]+val+");");},0x4c:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1])*4;val=(addr>>>0)+",";}
else{var addr=Number(operands[1])*4;if(addr)
val="("+operands[0]+"+"+addr+") >>>0"+",";else
val=operands[0]+",";}}
else{val="("+operands[0]+"+4*"+operands[1]+") >>>0"+",";}
context.code.push("self.MemW4("+val+operands[2]+")"+";");},0x4d:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1])*2;val=(addr>>>0)+",";}
else{var addr=Number(operands[1])*2;if(addr)
val="("+operands[0]+"+"+addr+") >>>0"+",";else
val=operands[0]+",";}}
else{val="("+operands[0]+"+2*"+operands[1]+") >>>0"+",";}
context.code.push("self.MemW2("+val+operands[2]+")"+";");},0x4e:function(context,operands){var val,addr;if(quot_isconstant(operands[1])){if(quot_isconstant(operands[0])){addr=Number(operands[0])+Number(operands[1]);val=(addr>>>0)+",";}
else{var addr=Number(operands[1]);if(addr)
val="("+operands[0]+"+"+addr+") >>>0"+",";else
val=operands[0]+",";}}
else{val="("+operands[0]+"+"+operands[1]+") >>>0"+",";}
context.code.push("self.MemW1("+val+operands[2]+")"+";");},0x4b:function(context,operands){if(quot_isconstant(operands[1])){var bitx,addrx,bitnum;bitnum=Number(operands[1])&0xffffffff;bitx=bitnum&7;if(quot_isconstant(operands[0])){addrx=Number(operands[0]);if(bitnum>=0)
addrx+=(bitnum>>3);else
addrx-=(1+((-1-bitnum)>>3));}
else{if(bitnum>=0){if(bitnum<=7)
addrx=operands[0];else
addrx=(operands[0]+"+"+(bitnum>>3));}
else{addrx=(operands[0]+"-"+(1+((-1-bitnum)>>3)));}}
context.code.push(operands[2]+"(self.Mem1("+addrx+") & "+(1<<bitx)+")?1:0);");}
else{context.varsused["bitx"]=true;context.varsused["addrx"]=true;var sign1=oputil_signify_operand(context,operands[1],true);context.code.push("bitx = "+sign1+"&7;");context.code.push("if ("+sign1+">=0) addrx = "+operands[0]+" + ("+sign1+">>3);");context.code.push("else addrx = "+operands[0]+" - (1+((-1-("+sign1+"))>>3));");context.code.push(operands[2]+"(self.Mem1(addrx) & (1<<bitx))?1:0);");}},0x4f:function(context,operands){var bitx,addrx,mask,bitnum;if(quot_isconstant(operands[1])){bitnum=Number(operands[1])&0xffffffff;bitx=bitnum&7;if(quot_isconstant(operands[0])){addrx=Number(operands[0]);if(bitnum>=0)
addrx+=(bitnum>>3);else
addrx-=(1+((-1-bitnum)>>3));}
else{if(bitnum>=0){if(bitnum<=7)
addrx=operands[0];else
addrx=(operands[0]+"+"+(bitnum>>3));}
else{addrx=(operands[0]+"-"+(1+((-1-bitnum)>>3)));}}
mask=(1<<bitx);}
else{context.varsused["bitx"]=true;context.varsused["addrx"]=true;var sign1=oputil_signify_operand(context,operands[1],true);context.code.push("bitx = "+sign1+"&7;");context.code.push("if ("+sign1+">=0) addrx = "+operands[0]+" + ("+sign1+">>3);");context.code.push("else addrx = "+operands[0]+" - (1+((-1-("+sign1+"))>>3));");addrx="addrx";mask="(1<<bitx)";}
if(quot_isconstant(operands[2])){if(Number(operands[2]))
context.code.push("self.MemW1("+addrx+", self.Mem1("+addrx+") | "+mask+");");else
context.code.push("self.MemW1("+addrx+", self.Mem1("+addrx+") & ~("+mask+"));");}
else{context.code.push("if ("+operands[2]+") self.MemW1("+addrx+", self.Mem1("+addrx+") | "+mask+");");context.code.push("else self.MemW1("+addrx+", self.Mem1("+addrx+") & ~("+mask+"));");}},0x50:function(context,operands){var val;var count=context.offstack.length;if(count)
val="self.frame.valstack.length+"+count;else
val="self.frame.valstack.length";oputil_store(context,operands[0],val);},0x51:function(context,operands){var val;if(quot_isconstant(operands[0])){var pos=Number(operands[0]);if(pos<context.offstack.length){val=context.offstack[context.offstack.length-(pos+1)];}
else{val="self.frame.valstack[self.frame.valstack.length-"+((pos+1)-context.offstack.length)+"]";}}
else{oputil_unload_offstate(context);val="self.frame.valstack[self.frame.valstack.length-("+operands[0]+"+1)]";}
oputil_store(context,operands[1],val);},0x52:function(context,operands){var temp,len;if(context.offstack.length<2){transfer_to_offstack(context,2);}
len=context.offstack.length;temp=context.offstack[len-1];context.offstack[len-1]=context.offstack[len-2];context.offstack[len-2]=temp;},0x53:function(context,operands){oputil_unload_offstate(context);context.varsused["ix"]=true;context.varsused["pos"]=true;context.varsused["roll"]=true;context.varsused["vals1"]=true;var sign0=oputil_signify_operand(context,operands[0],true);var sign1=oputil_signify_operand(context,operands[1],true);context.code.push("if ("+sign0+" > 0) {");context.code.push("if ("+sign1+" > 0) {");context.code.push("vals1 = "+sign1+" % "+sign0+";");context.code.push("} else {");context.code.push("vals1 = "+sign0+" - (-("+sign1+")) % "+sign0+";");context.code.push("}");context.code.push("if (vals1) {");context.code.push("pos = self.frame.valstack.length - "+sign0+";");context.code.push("roll = self.frame.valstack.slice(self.frame.valstack.length-vals1, self.frame.valstack.length).concat(self.frame.valstack.slice(pos, self.frame.valstack.length-vals1));");context.code.push("for (ix=0; ix<"+sign0+"; ix++) { self.frame.valstack[pos+ix] = roll[ix]; }");context.code.push("roll = undefined;");context.code.push("}");context.code.push("}");},0x54:function(context,operands){oputil_unload_offstate(context);if(quot_isconstant(operands[0])){var ix,holdvar;var pos=Number(operands[0]);for(ix=0;ix<pos;ix++){holdvar=alloc_holdvar(context,true);context.offstack.push(holdvar);context.code.push(holdvar+"=self.frame.valstack[self.frame.valstack.length-"+(pos-ix)+"];");}}
else{context.varsused["ix"]=true;context.varsused["jx"]=true;context.code.push("jx = self.frame.valstack.length-("+operands[0]+");");context.code.push("for (ix=0; ix<"+operands[0]+"; ix++) { self.frame.valstack.push(self.frame.valstack[jx+ix]); }");}},0x100:function(context,operands){var expr="self.do_gestalt(("+operands[0]+"),("+operands[1]+"))";context.code.push(operands[2]+expr+");");},0x101:function(context,operands){context.code.push("self.fatal_error('User debugtrap encountered.', "+operands[0]+");");},0x102:function(context,operands){context.code.push(operands[0]+"self.endmem);");},0x103:function(context,operands){context.code.push("self.change_memsize("+operands[0]+",false);");context.code.push(operands[1]+"0);");},0x110:function(context,operands){var expr;var sign0=oputil_signify_operand(context,operands[0],true);context.code.push(operands[1]+"self.random_func("+sign0+") >>>0);");},0x111:function(context,operands){context.code.push("self.set_random("+operands[0]+");");},0x120:function(context,operands){context.offstack.length=0;context.offloc.length=0;context.offlocdirty.length=0;context.code.push("return self.VMStopped;");context.path_ends=true;},0x121:function(context,operands){context.code.push(operands[0]+"self.perform_verify());");},0x122:function(context,operands){context.offstack.length=0;context.offloc.length=0;context.offlocdirty.length=0;context.code.push("self.vm_restart();");context.code.push("return;");context.path_ends=true;},0x123:function(context,operands){oputil_unload_offstate(context);context.varsused["ix"]=true;oputil_push_callstub(context,operands[1]);context.code.push("ix = self.vm_save("+operands[0]+");");context.code.push("self.pop_callstub(ix ? 0 : 1);");context.code.push("return;");context.path_ends=true;},0x124:function(context,operands){oputil_unload_offstate(context);context.code.push("if (self.vm_restore("+operands[0]+")) {");context.code.push("self.pop_callstub((-1)>>>0);");context.code.push("} else {");oputil_store(context,operands[1],"1");oputil_unload_offstate(context);context.code.push("self.pc = "+context.cp+";");context.code.push("}");context.code.push("return;");context.path_ends=true;},0x125:function(context,operands){oputil_unload_offstate(context);oputil_push_callstub(context,operands[0]);context.code.push("self.vm_saveundo();");context.code.push("self.pop_callstub(0);");context.code.push("return;");context.path_ends=true;},0x126:function(context,operands){oputil_unload_offstate(context);context.code.push("if (self.vm_restoreundo()) {");context.code.push("self.pop_callstub((-1)>>>0);");context.code.push("} else {");oputil_store(context,operands[0],"1");oputil_unload_offstate(context);context.code.push("self.pc = "+context.cp+";");context.code.push("}");context.code.push("return;");context.path_ends=true;},0x127:function(context,operands){context.code.push("self.protectstart="+operands[0]+";");context.code.push("self.protectend=self.protectstart+("+operands[1]+");");context.code.push("if (self.protectstart==self.protectend) {")
context.code.push("  self.protectstart=0; self.protectend=0;");context.code.push("}");},0x128:function(context,operands){context.code.push(operands[0]+"(self.vm_hasundo() ? 0 : 1));");},0x129:function(context,operands){context.code.push("self.vm_discardundo();");},0x170:function(context,operands){context.varsused["maddr"]=true;context.varsused["mlen"]=true;context.varsused["ix"]=true;context.code.push("mlen="+operands[0]+";");context.code.push("maddr="+operands[1]+";");context.code.push("for (ix=0; ix<mlen; ix++, maddr++) self.MemW1(maddr, 0);");},0x171:function(context,operands){context.varsused["msrc"]=true;context.varsused["mdest"]=true;context.varsused["mlen"]=true;context.varsused["ix"]=true;context.code.push("mlen="+operands[0]+";");context.code.push("msrc="+operands[1]+";");context.code.push("mdest="+operands[2]+";");context.code.push("if (mdest < msrc) {");context.code.push("for (ix=0; ix<mlen; ix++, msrc++, mdest++) self.MemW1(mdest, self.Mem1(msrc));");context.code.push("} else {");context.code.push("msrc += (mlen-1); mdest += (mlen-1);");context.code.push("for (ix=0; ix<mlen; ix++, msrc--, mdest--) self.MemW1(mdest, self.Mem1(msrc));");context.code.push("}");},0x178:function(context,operands){var expr="self.heap_malloc("+operands[0]+")";context.code.push(operands[1]+expr+");");},0x179:function(context,operands){context.code.push("self.heap_free("+operands[0]+");");},0x180:function(context,operands){context.code.push("self.accel_funcnum_map["+operands[1]+"] = "+operands[0]+";");context.code.push("self.accel_address_map["+operands[1]+"] = self.accel_func_map["+operands[0]+"];");},0x181:function(context,operands){context.code.push("if ("+operands[0]+" < 9) {");context.code.push("  self.accel_params["+operands[0]+"] = "+operands[1]+";");context.code.push("}");},0x150:function(context,operands){var expr="self.linear_search(("+operands[0]+"),("+operands[1]+"),("+operands[2]+"),("+operands[3]+"),("+operands[4]+"),("+operands[5]+"),("+operands[6]+"))";context.code.push(operands[7]+expr+");");},0x151:function(context,operands){var expr="self.binary_search(("+operands[0]+"),("+operands[1]+"),("+operands[2]+"),("+operands[3]+"),("+operands[4]+"),("+operands[5]+"),("+operands[6]+"))";context.code.push(operands[7]+expr+");");},0x152:function(context,operands){var expr="self.linked_search(("+operands[0]+"),("+operands[1]+"),("+operands[2]+"),("+operands[3]+"),("+operands[4]+"),("+operands[5]+"))";context.code.push(operands[6]+expr+");");},0x70:function(context,operands){switch(context.curiosys){case 2:if(quot_isconstant(operands[0])){var val=Number(operands[0])&0xff;context.code.push("self.Glk.glk_put_char("+val+");");}
else{context.code.push("self.Glk.glk_put_char(("+operands[0]+")&0xff);");}
break;case 1:oputil_unload_offstate(context);context.code.push("self.tempcallargs[0]=(("+operands[0]+")&0xff);");oputil_push_callstub(context,"0,0");context.code.push("self.enter_function(self.iosysrock, 1);");context.code.push("return;");context.path_ends=true;break;case 0:break;}},0x71:function(context,operands){switch(context.curiosys){case 2:var sign0=oputil_signify_operand(context,operands[0]);if(quot_isconstant(operands[0])){var val=Number(sign0).toString(10);context.code.push("self.Glk.glk_put_jstring("+QuoteEscapeString(val)+", true);");}
else{context.code.push("self.Glk.glk_put_jstring(("+sign0+").toString(10), true);");}
break;case 1:oputil_unload_offstate(context);context.code.push("self.stream_num("+context.cp+","+operands[0]+", false, 0);");context.code.push("return;");context.path_ends=true;break;case 0:break;}},0x72:function(context,operands){oputil_unload_offstate(context);context.code.push("if (self.stream_string("+context.cp+","+operands[0]+", 0, 0)) return;");},0x73:function(context,operands){switch(context.curiosys){case 2:if(quot_isconstant(operands[0])){var val=Number(operands[0]);context.code.push("self.Glk.glk_put_char_uni("+val+");");}
else{context.code.push("self.Glk.glk_put_char_uni("+operands[0]+");");}
break;case 1:oputil_unload_offstate(context);context.code.push("self.tempcallargs[0]=("+operands[0]+");");oputil_push_callstub(context,"0,0");context.code.push("self.enter_function(self.iosysrock, 1);");context.code.push("return;");context.path_ends=true;break;case 0:break;}},0x140:function(context,operands){context.code.push(operands[0]+"self.stringtable)");},0x141:function(context,operands){context.code.push("self.set_string_table("+operands[0]+");");},0x148:function(context,operands){context.code.push(operands[0]+"self.iosysmode)");context.code.push(operands[1]+"self.iosysrock)");},0x149:function(context,operands){context.code.push("self.set_iosys("+operands[0]+","+operands[1]+");");if(quot_isconstant(operands[0])){var val=Number(operands[0]);context.curiosys=val;}
else{oputil_unload_offstate(context);context.code.push("self.pc = "+context.cp+";");context.code.push("return;");context.path_ends=true;}},0x190:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);if(quot_isconstant(operands[0])){var val=Number(sign0);context.code.push(operands[1]+encode_float(val)+");");}
else{context.code.push(operands[1]+"self.encode_float("+sign0+"));");}},0x191:function(context,operands){context.varsused["valf"]=true;context.varsused["res"]=true;context.code.push("valf = "+oputil_decode_float(context,operands[0])+";");context.code.push("if (!("+operands[0]+" & 0x80000000)) {");context.code.push("  if (isNaN(valf) || !isFinite(valf) || (valf > 0x7fffffff))");context.code.push("    res = 0x7fffffff;");context.code.push("  else");context.code.push("    res = Math.floor(valf);");context.code.push("} else {");context.code.push("  if (isNaN(valf) || !isFinite(valf) || (valf < -0x80000000))");context.code.push("    res = -0x80000000;");context.code.push("  else");context.code.push("    res = Math.ceil(valf);");context.code.push("}");context.code.push(operands[1]+"res>>>0);");},0x192:function(context,operands){context.varsused["valf"]=true;context.varsused["res"]=true;context.code.push("valf = "+oputil_decode_float(context,operands[0])+";");context.code.push("if (!("+operands[0]+" & 0x80000000)) {");context.code.push("  if (isNaN(valf) || !isFinite(valf))");context.code.push("    res = 0x7fffffff;");context.code.push("  else");context.code.push("    res = Math.round(valf);");context.code.push("  if (res > 0x7fffffff) res = 0x7fffffff;");context.code.push("} else {");context.code.push("  if (isNaN(valf) || !isFinite(valf))");context.code.push("    res = -0x80000000;");context.code.push("  else");context.code.push("    res = Math.round(valf);");context.code.push("  if (res < -0x80000000) res = -0x80000000;");context.code.push("}");context.code.push(operands[1]+"res>>>0);");},0x198:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.ceil("+valf+")));");},0x199:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.floor("+valf+")));");},0x1A0:function(context,operands){var valf0=oputil_decode_float(context,operands[0]);var valf1=oputil_decode_float(context,operands[1]);context.code.push(operands[2]+"self.encode_float("+valf0+" + "+valf1+"));");},0x1A1:function(context,operands){var valf0=oputil_decode_float(context,operands[0]);var valf1=oputil_decode_float(context,operands[1]);context.code.push(operands[2]+"self.encode_float("+valf0+" - "+valf1+"));");},0x1A2:function(context,operands){var valf0=oputil_decode_float(context,operands[0]);var valf1=oputil_decode_float(context,operands[1]);context.code.push(operands[2]+"self.encode_float("+valf0+" * "+valf1+"));");},0x1A3:function(context,operands){var valf0=oputil_decode_float(context,operands[0]);var valf1=oputil_decode_float(context,operands[1]);context.code.push(operands[2]+"self.encode_float("+valf0+" / "+valf1+"));");},0x1A4:function(context,operands){var valf0=oputil_decode_float(context,operands[0],true);var valf1=oputil_decode_float(context,operands[1],true);context.varsused["modv"]=true;context.varsused["quov"]=true;context.code.push("modv=("+valf0+" % "+valf1+");");context.code.push("quov=self.encode_float(("+valf0+" - modv) / "+valf1+");");context.code.push("if (quov == 0x0 || quov == 0x80000000) {");context.code.push("  quov = (("+operands[0]+" ^ "+operands[1]+") & 0x80000000) >>>0;");context.code.push("}");context.code.push(operands[2]+"self.encode_float(modv));");context.code.push(operands[3]+"quov);");},0x1A8:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.sqrt("+valf+")));");},0x1A9:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.exp("+valf+")));");},0x1AA:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.log("+valf+")));");},0x1AB:function(context,operands){context.varsused["valf"]=true;var valf0=oputil_decode_float(context,operands[0],true);var valf1=oputil_decode_float(context,operands[1],true);context.code.push("if ("+operands[0]+" == 0x3f800000) {");context.code.push("  valf = 0x3f800000;");context.code.push("} else if ("+operands[0]+" == 0xbf800000 && ("+operands[1]+" == 0xff800000 || "+operands[1]+" == 0x7f800000)) {");context.code.push("  valf = 0x3f800000;");context.code.push("} else {");context.code.push("  valf=self.encode_float(Math.pow("+valf0+", "+valf1+"));");context.code.push("}");context.code.push(operands[2]+"valf);");},0x1B0:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.sin("+valf+")));");},0x1B1:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.cos("+valf+")));");},0x1B2:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.tan("+valf+")));");},0x1B3:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.asin("+valf+")));");},0x1B4:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.acos("+valf+")));");},0x1B5:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.code.push(operands[1]+"self.encode_float(Math.atan("+valf+")));");},0x1B6:function(context,operands){var valf0=oputil_decode_float(context,operands[0]);var valf1=oputil_decode_float(context,operands[1]);context.code.push(operands[2]+"self.encode_float(Math.atan2("+valf0+", "+valf1+")));");},0x1C0:function(context,operands){var val,valf0,valf1,valf2;context.varsused["fequal"]=true;context.varsused["fdiff"]=true;context.code.push("if (("+operands[2]+" & 0x7f800000) == 0x7f800000 && ("+operands[2]+" & 0x007fffff) != 0) {");context.code.push("  fequal = 0;");context.code.push("} else if (("+operands[0]+" == 0xff800000 || "+operands[0]+" == 0x7f800000) && ("+operands[1]+" == 0xff800000 || "+operands[1]+" == 0x7f800000)) {");context.code.push("  fequal = ("+operands[0]+" == "+operands[1]+");");context.code.push("} else {");if(quot_isconstant(operands[2])){val=Number(operands[2]);valf2=""+decode_float(val&0x7fffffff);}
else{val="self.decode_float(("+operands[2]+") & 0x7fffffff)";valf2=alloc_holdvar(context);context.code.push(valf2+"="+val+";");}
valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("  fdiff = "+valf1+" - "+valf0+";");context.code.push("  fequal = (fdiff <= "+valf2+" && fdiff >= -("+valf2+"));");context.code.push("}");context.code.push("if (fequal) {");oputil_perform_jump(context,operands[3]);context.code.push("}");},0x1C1:function(context,operands){var val,valf0,valf1,valf2;context.varsused["fequal"]=true;context.varsused["fdiff"]=true;context.code.push("if (("+operands[2]+" & 0x7f800000) == 0x7f800000 && ("+operands[2]+" & 0x007fffff) != 0) {");context.code.push("  fequal = 0;");context.code.push("} else if (("+operands[0]+" == 0xff800000 || "+operands[0]+" == 0x7f800000) && ("+operands[1]+" == 0xff800000 || "+operands[1]+" == 0x7f800000)) {");context.code.push("  fequal = ("+operands[0]+" == "+operands[1]+");");context.code.push("} else {");if(quot_isconstant(operands[2])){val=Number(operands[2]);valf2=""+decode_float(val&0x7fffffff);}
else{val="self.decode_float(("+operands[2]+") & 0x7fffffff)";valf2=alloc_holdvar(context);context.code.push(valf2+"="+val+";");}
valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("  fdiff = "+valf1+" - "+valf0+";");context.code.push("  fequal = (fdiff <= "+valf2+" && fdiff >= -("+valf2+"));");context.code.push("}");context.code.push("if (!fequal) {");oputil_perform_jump(context,operands[3]);context.code.push("}");},0x1C2:function(context,operands){var valf0,valf1;valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("if ("+valf0+" < "+valf1+") {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x1C3:function(context,operands){var valf0,valf1;valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("if ("+valf0+" <= "+valf1+") {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x1C4:function(context,operands){var valf0,valf1;valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("if ("+valf0+" > "+valf1+") {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x1C5:function(context,operands){var valf0,valf1;valf0=oputil_decode_float(context,operands[0]);valf1=oputil_decode_float(context,operands[1]);context.code.push("if ("+valf0+" >= "+valf1+") {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x1C8:function(context,operands){context.code.push("if (("+operands[0]+" & 0x7f800000) == 0x7f800000 && ("+operands[0]+" & 0x007fffff) != 0) {");oputil_perform_jump(context,operands[1]);context.code.push("}");},0x1C9:function(context,operands){context.code.push("if ("+operands[0]+" == 0xff800000 || "+operands[0]+" == 0x7f800000) {");oputil_perform_jump(context,operands[1]);context.code.push("}");},0x200:function(context,operands){var sign0=oputil_signify_operand(context,operands[0]);if(quot_isconstant(operands[0])){var val=Number(sign0);var valpair=encode_double(val);context.code.push(operands[1]+valpair.lo+");");context.code.push(operands[2]+valpair.hi+");");}
else{context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+sign0+");");context.code.push(operands[1]+"dbl.lo);");context.code.push(operands[2]+"dbl.hi);");}},0x201:function(context,operands){context.varsused["vald"]=true;context.varsused["res"]=true;context.code.push("vald = "+oputil_decode_double(context,operands[0],operands[1])+";");context.code.push("if (!("+operands[0]+" & 0x80000000)) {");context.code.push("  if (isNaN(vald) || !isFinite(vald) || (vald > 0x7fffffff))");context.code.push("    res = 0x7fffffff;");context.code.push("  else");context.code.push("    res = Math.floor(vald);");context.code.push("} else {");context.code.push("  if (isNaN(vald) || !isFinite(vald) || (vald < -0x80000000))");context.code.push("    res = -0x80000000;");context.code.push("  else");context.code.push("    res = Math.ceil(vald);");context.code.push("}");context.code.push(operands[2]+"res>>>0);");},0x202:function(context,operands){context.varsused["vald"]=true;context.varsused["res"]=true;context.code.push("vald = "+oputil_decode_double(context,operands[0],operands[1])+";");context.code.push("if (!("+operands[0]+" & 0x80000000)) {");context.code.push("  if (isNaN(vald) || !isFinite(vald))");context.code.push("    res = 0x7fffffff;");context.code.push("  else");context.code.push("    res = Math.round(vald);");context.code.push("  if (res > 0x7fffffff) res = 0x7fffffff;");context.code.push("} else {");context.code.push("  if (isNaN(vald) || !isFinite(vald))");context.code.push("    res = -0x80000000;");context.code.push("  else");context.code.push("    res = Math.round(vald);");context.code.push("  if (res < -0x80000000) res = -0x80000000;");context.code.push("}");context.code.push(operands[2]+"res>>>0);");},0x203:function(context,operands){var valf=oputil_decode_float(context,operands[0]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+valf+");");context.code.push(operands[1]+"dbl.lo);");context.code.push(operands[2]+"dbl.hi);");},0x204:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.code.push(operands[2]+"self.encode_float("+vald+"));");},0x208:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.ceil("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x209:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.floor("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x210:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+vald1+" + "+vald2+");");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x211:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+vald1+" - "+vald2+");");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x212:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+vald1+" * "+vald2+");");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x213:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+vald1+" / "+vald2+");");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x214:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double("+vald1+" % "+vald2+");");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x215:function(context,operands){context.varsused["vald1"]=true;context.varsused["vald2"]=true;context.code.push("vald1 = "+oputil_decode_double(context,operands[0],operands[1])+";");context.code.push("vald2 = "+oputil_decode_double(context,operands[2],operands[3])+";");context.varsused["dbl"]=true;context.varsused["modv"]=true;context.varsused["quov"]=true;context.code.push("modv=(vald1 % vald2);");context.code.push("dbl=self.encode_double((vald1 - modv) / vald2);");context.code.push("if ((dbl.hi == 0x0 || dbl.hi == 0x80000000) && dbl.lo == 0x0) {");context.code.push("  dbl.hi = (("+operands[0]+" ^ "+operands[2]+") & 0x80000000) >>>0;");context.code.push("}");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x218:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.sqrt("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x219:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.exp("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x21A:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.log("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x21B:function(context,operands){context.varsused["dbl"]=true;var vald0=oputil_decode_double(context,operands[0],operands[1],true);var vald1=oputil_decode_double(context,operands[2],operands[3],true);context.code.push("if ("+operands[0]+" == 0x3ff00000 && "+operands[1]+" == 0x0) {");context.code.push("  dbl = { hi:0x3ff00000, lo:0x0 };");context.code.push("} else if ("+operands[0]+" == 0xbff00000 && "+operands[1]+" == 0x0 && ("+operands[2]+" == 0xfff00000 || "+operands[2]+" == 0x7ff00000) && "+operands[3]+" == 0x0) {");context.code.push("  dbl = { hi:0x3ff00000, lo:0x0 };");context.code.push("} else {");context.code.push("  dbl=self.encode_double(Math.pow("+vald0+", "+vald1+"));");context.code.push("}");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x220:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.sin("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x221:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.cos("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x222:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.tan("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x223:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.asin("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x224:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.acos("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x225:function(context,operands){var vald=oputil_decode_double(context,operands[0],operands[1]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.atan("+vald+"));");context.code.push(operands[2]+"dbl.lo);");context.code.push(operands[3]+"dbl.hi);");},0x226:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.varsused["dbl"]=true;context.code.push("dbl=self.encode_double(Math.atan2("+vald1+", "+vald2+"));");context.code.push(operands[4]+"dbl.lo);");context.code.push(operands[5]+"dbl.hi);");},0x230:function(context,operands){var val,valhi,vallo,vald0,vald1,vald2;context.varsused["dequal"]=true;context.varsused["ddiff"]=true;context.code.push("if (("+operands[4]+" & 0x7ff00000) == 0x7ff00000 && (("+operands[4]+" & 0xfffff) != 0x0 || "+operands[5]+" != 0x0)) {");context.code.push("  dequal = 0;");context.code.push("} else if (("+operands[0]+" == 0xfff00000 || "+operands[0]+" == 0x7ff00000) && ("+operands[1]+" == 0x0) && ("+operands[2]+" == 0xfff00000 || "+operands[2]+" == 0x7ff00000) && ("+operands[3]+" == 0x0)) {");context.code.push("  dequal = ("+operands[0]+" == "+operands[2]+" && "+operands[1]+" == "+operands[3]+");");context.code.push("} else {");if(quot_isconstant(operands[4])&&quot_isconstant(operands[5])){valhi=Number(operands[4]);vallo=Number(operands[5]);vald2=""+decode_double((valhi&0x7fffffff),(vallo&0x7fffffff));}
else{val="self.decode_double((("+operands[4]+") & 0x7fffffff), ("+operands[5]+"))";vald2=alloc_holdvar(context);context.code.push(vald2+"="+val+";");}
vald0=oputil_decode_double(context,operands[0],operands[1]);vald1=oputil_decode_double(context,operands[2],operands[3]);context.code.push("  ddiff = "+vald1+" - "+vald0+";");context.code.push("  dequal = (ddiff <= "+vald2+" && ddiff >= -("+vald2+"));");context.code.push("}");context.code.push("if (dequal) {");oputil_perform_jump(context,operands[6]);context.code.push("}");},0x231:function(context,operands){var val,valhi,vallo,vald0,vald1,vald2;context.varsused["dequal"]=true;context.varsused["ddiff"]=true;context.code.push("if (("+operands[4]+" & 0x7ff00000) == 0x7ff00000 && (("+operands[4]+" & 0xfffff) != 0x0 || "+operands[5]+" != 0x0)) {");context.code.push("  dequal = 0;");context.code.push("} else if (("+operands[0]+" == 0xfff00000 || "+operands[0]+" == 0x7ff00000) && ("+operands[1]+" == 0x0) && ("+operands[2]+" == 0xfff00000 || "+operands[2]+" == 0x7ff00000) && ("+operands[3]+" == 0x0)) {");context.code.push("  dequal = ("+operands[0]+" == "+operands[2]+" && "+operands[1]+" == "+operands[3]+");");context.code.push("} else {");if(quot_isconstant(operands[4])&&quot_isconstant(operands[5])){valhi=Number(operands[4]);vallo=Number(operands[5]);vald2=""+decode_double((valhi&0x7fffffff),(vallo&0x7fffffff));}
else{val="self.decode_double((("+operands[4]+") & 0x7fffffff), ("+operands[5]+"))";vald2=alloc_holdvar(context);context.code.push(vald2+"="+val+";");}
vald0=oputil_decode_double(context,operands[0],operands[1]);vald1=oputil_decode_double(context,operands[2],operands[3]);context.code.push("  ddiff = "+vald1+" - "+vald0+";");context.code.push("  dequal = (ddiff <= "+vald2+" && ddiff >= -("+vald2+"));");context.code.push("}");context.code.push("if (!dequal) {");oputil_perform_jump(context,operands[6]);context.code.push("}");},0x232:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.code.push("if ("+vald1+" < "+vald2+") {");oputil_perform_jump(context,operands[4]);context.code.push("}");},0x233:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.code.push("if ("+vald1+" <= "+vald2+") {");oputil_perform_jump(context,operands[4]);context.code.push("}");},0x234:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.code.push("if ("+vald1+" > "+vald2+") {");oputil_perform_jump(context,operands[4]);context.code.push("}");},0x235:function(context,operands){var vald1=oputil_decode_double(context,operands[0],operands[1]);var vald2=oputil_decode_double(context,operands[2],operands[3]);context.code.push("if ("+vald1+" >= "+vald2+") {");oputil_perform_jump(context,operands[4]);context.code.push("}");},0x238:function(context,operands){context.code.push("if ((("+operands[0]+" & 0x7ff00000) == 0x7ff00000) && (("+operands[0]+" & 0xfffff) != 0x0 || "+operands[1]+" != 0x0)) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x239:function(context,operands){context.code.push("if (("+operands[0]+" == 0xfff00000 || "+operands[0]+" == 0x7ff00000) && "+operands[1]+" == 0x0) {");oputil_perform_jump(context,operands[2]);context.code.push("}");},0x130:function(context,operands){var mayblock;if(quot_isconstant(operands[0]))
mayblock=self.Glk.call_may_not_return(Number(operands[0]));else
mayblock=true;if(mayblock){context.code.push("  self.prevpc = "+context.prevcp+";");context.code.push("  self.pc = "+context.cp+";");}
context.code.push("self.tempglkargs.length = "+operands[1]+";");if(quot_isconstant(operands[1])){var ix;var argc=Number(operands[1]);for(ix=0;ix<argc;ix++){if(context.offstack.length){var holdvar=pop_offstack_holdvar(context);context.code.push("self.tempglkargs["+ix+"]="+holdvar+";");}
else{context.code.push("self.tempglkargs["+ix+"]=self.frame.valstack.pop();");}}
oputil_unload_offstate(context);}
else{context.varsused["ix"]=true;oputil_unload_offstate(context);context.code.push("for (ix=0; ix<"+operands[1]+"; ix++) { self.tempglkargs[ix]=self.frame.valstack.pop(); }");}
context.varsused["glkret"]=true;context.code.push("glkret = self.GiDispa.get_function("+operands[0]+")(self.tempglkargs);");if(mayblock){context.code.push("if (glkret === self.Glk.DidNotReturn) {");context.code.push("  self.resumefuncop = "+oputil_record_funcop(operands[2])+";");context.code.push("  self.resumevalue = 0;");context.code.push("  self.pc = "+context.cp+";");context.code.push("  self.done_executing = true;");context.code.push("  return;");context.code.push("}");}
oputil_store(context,operands[2],"glkret");}}
function alloc_holdvar(context,use){var ix=0;var key;while(true){key="_hold"+ix;if(!context.holduse[key]){context.holduse[key]=(use?1:true);return key;}
ix++;}}
function pop_offstack_holdvar(context){var holdvar=context.offstack.pop();if(quot_isconstant(holdvar)){return holdvar;}
var use=context.holduse[holdvar];use--;if(use==0)
use=true;context.holduse[holdvar]=use;return holdvar;}
function push_offstack_holdvar(context,holdvar){context.offstack.push(holdvar);var use=context.holduse[holdvar];if(!use||use===true)
use=1;else
use++;context.holduse[holdvar]=use;}
function store_offloc_value(context,addr,value,inchold){var oldvar=context.offloc[addr];if(oldvar&&quot_isholdvar(oldvar)){var use=context.holduse[oldvar];use--;if(use==0)
use=true;context.holduse[oldvar]=use;}
if(value===undefined){context.offloc[addr]=undefined;context.offlocdirty[addr]=false;return;}
context.offloc[addr]=value;context.offlocdirty[addr]=true;if(inchold){var holdvar=value;var use=context.holduse[holdvar];if(!use||use===true)
use=1;else
use++;context.holduse[holdvar]=use;}}
function transfer_to_offstack(context,count){var holdvar;while(context.offstack.length<count){holdvar=alloc_holdvar(context,true);context.offstack.unshift(holdvar);context.code.push(holdvar+"=self.frame.valstack.pop();");}}
function quot_isconstant(val){return(val[0]==="0");}
function quot_isholdvar(val){return(val[0]==="_");}
function parse_operands(context,cp,oplist,operands){var modeaddr;var ix,modeval,mode;var value,addr;var holdvar;operands.desttype=0;operands.numops=oplist.numops;modeaddr=cp;cp+=((oplist.numops+1)>>1);for(ix=0;ix<oplist.numops;ix++){if((ix&1)==0){modeval=Mem1(modeaddr);mode=(modeval&0x0F);}
else{mode=((modeval>>4)&0x0F);modeaddr++;}
var optype=oplist.formlist[ix];if(optype=="L"){switch(mode){case 8:if(context.offstack.length){operands[ix]=pop_offstack_holdvar(context);}
else{holdvar=alloc_holdvar(context);context.code.push(holdvar+"=self.frame.valstack.pop();");operands[ix]=holdvar;}
continue;case 0:operands[ix]="0";continue;case 1:value=QuoteMem1(cp);cp++;operands[ix]=value;continue;case 2:value=QuoteMem2(cp);cp+=2;operands[ix]=value;continue;case 3:value=QuoteMem4(cp);cp+=4;operands[ix]=value;continue;}
if(mode>=9&&mode<=11){if(mode==9){addr=Mem1(cp);cp++;}
else if(mode==10){addr=Mem2(cp);cp+=2;}
else if(mode==11){addr=Mem4(cp);cp+=4;}
if(context.offloc[addr]!==undefined){operands[ix]=context.offloc[addr];continue;}
if(oplist.argsize==4){value="self.frame.locals["+addr+"]";}
else if(oplist.argsize==2){value="self.frame.locals["+addr+"] & 0xffff";}
else{value="self.frame.locals["+addr+"] & 0xff";}
holdvar=alloc_holdvar(context,true);context.code.push(holdvar+"=("+value+");");context.offloc[addr]=holdvar;context.offlocdirty[addr]=false;operands[ix]=holdvar;continue;}
switch(mode){case 15:addr=Mem4(cp)+ramstart;cp+=4;break;case 14:addr=Mem2(cp)+ramstart;cp+=2;break;case 13:addr=Mem1(cp)+ramstart;cp++;break;case 7:addr=Mem4(cp);cp+=4;break;case 6:addr=Mem2(cp);cp+=2;break;case 5:addr=Mem1(cp);cp++;break;default:fatal_error("Unknown addressing mode in load operand.");}
if(oplist.argsize==4){value="self.Mem4("+addr+")";}
else if(oplist.argsize==2){value="self.Mem2("+addr+")";}
else{value="self.Mem1("+addr+")";}
holdvar=alloc_holdvar(context);context.code.push(holdvar+"=("+value+");");operands[ix]=holdvar;continue;}
else if(optype=="E"){switch(mode){case 8:if(context.offstack.length){operands[ix]=pop_offstack_holdvar(context);}
else{operands[ix]="self.frame.valstack.pop()";}
continue;case 0:operands[ix]="0";continue;case 1:value=QuoteMem1(cp);cp++;operands[ix]=value;continue;case 2:value=QuoteMem2(cp);cp+=2;operands[ix]=value;continue;case 3:value=QuoteMem4(cp);cp+=4;operands[ix]=value;continue;}
if(mode>=9&&mode<=11){if(mode==9){addr=Mem1(cp);cp++;}
else if(mode==10){addr=Mem2(cp);cp+=2;}
else if(mode==11){addr=Mem4(cp);cp+=4;}
if(context.offloc[addr]!==undefined){operands[ix]=context.offloc[addr];continue;}
if(oplist.argsize==4){value="self.frame.locals["+addr+"]";}
else if(oplist.argsize==2){value="self.frame.locals["+addr+"] & 0xffff";}
else{value="self.frame.locals["+addr+"] & 0xff";}
holdvar=alloc_holdvar(context,true);context.code.push(holdvar+"=("+value+");");context.offloc[addr]=holdvar;context.offlocdirty[addr]=false;operands[ix]=holdvar;continue;}
switch(mode){case 15:addr=Mem4(cp)+ramstart;cp+=4;break;case 14:addr=Mem2(cp)+ramstart;cp+=2;break;case 13:addr=Mem1(cp)+ramstart;cp++;break;case 7:addr=Mem4(cp);cp+=4;break;case 6:addr=Mem2(cp);cp+=2;break;case 5:addr=Mem1(cp);cp++;break;default:fatal_error("Unknown addressing mode in load operand.");}
if(oplist.argsize==4){value="self.Mem4("+addr+")";}
else if(oplist.argsize==2){value="self.Mem2("+addr+")";}
else{value="self.Mem1("+addr+")";}
operands[ix]=value;continue;}
else if(optype=="S"){switch(mode){case 8:holdvar=alloc_holdvar(context,true);context.offstack.push(holdvar);operands[ix]=holdvar+"=(";continue;case 0:operands[ix]="(";continue;}
if(mode>=9&&mode<=11){if(mode==9){addr=Mem1(cp);cp++;}
else if(mode==10){addr=Mem2(cp);cp+=2;}
else if(mode==11){addr=Mem4(cp);cp+=4;}
if(oplist.argsize==4){holdvar=alloc_holdvar(context,true);store_offloc_value(context,addr,holdvar,false);operands[ix]=holdvar+"=(";}
else if(oplist.argsize==2){store_offloc_value(context,addr,undefined);operands[ix]="self.frame.locals["+addr+"]=(0xffff &";}
else{store_offloc_value(context,addr,undefined);operands[ix]="self.frame.locals["+addr+"]=(0xff &";}
continue;}
switch(mode){case 15:addr=Mem4(cp)+ramstart;cp+=4;break;case 14:addr=Mem2(cp)+ramstart;cp+=2;break;case 13:addr=Mem1(cp)+ramstart;cp++;break;case 7:addr=Mem4(cp);cp+=4;break;case 6:addr=Mem2(cp);cp+=2;break;case 5:addr=Mem1(cp);cp++;break;default:fatal_error("Unknown addressing mode in store operand.");}
if(oplist.argsize==4){value="self.MemW4("+addr+",";}
else if(oplist.argsize==2){value="self.MemW2("+addr+",";}
else{value="self.MemW1("+addr+",";}
operands[ix]=value;continue;}
else if(optype=="F"){var funcop=operands.func_store;switch(mode){case 8:funcop.mode=8;funcop.argsize=oplist.argsize;operands[ix]=funcop;continue;case 0:funcop.mode=0;funcop.argsize=oplist.argsize;operands[ix]=funcop;continue;}
if(mode>=9&&mode<=11){if(mode==9){addr=Mem1(cp);cp++;}
else if(mode==10){addr=Mem2(cp);cp+=2;}
else if(mode==11){addr=Mem4(cp);cp+=4;}
funcop.mode=11;funcop.addr=addr;funcop.argsize=oplist.argsize;operands[ix]=funcop;continue;}
switch(mode){case 15:addr=Mem4(cp)+ramstart;cp+=4;break;case 14:addr=Mem2(cp)+ramstart;cp+=2;break;case 13:addr=Mem1(cp)+ramstart;cp++;break;case 7:addr=Mem4(cp);cp+=4;break;case 6:addr=Mem2(cp);cp+=2;break;case 5:addr=Mem1(cp);cp++;break;default:fatal_error("Unknown addressing mode in store operand.");}
funcop.mode=15;funcop.addr=addr;funcop.argsize=oplist.argsize;operands[ix]=funcop;continue;}
else if(optype=="C"){switch(mode){case 8:operands[ix]="3,0";continue;case 0:operands[ix]="0,0";continue;}
if(mode>=9&&mode<=11){if(mode==9){addr=Mem1(cp);cp++;}
else if(mode==10){addr=Mem2(cp);cp+=2;}
else if(mode==11){addr=Mem4(cp);cp+=4;}
operands[ix]="2,"+addr;continue;}
switch(mode){case 15:addr=Mem4(cp)+ramstart;cp+=4;break;case 14:addr=Mem2(cp)+ramstart;cp+=2;break;case 13:addr=Mem1(cp)+ramstart;cp++;break;case 7:addr=Mem4(cp);cp+=4;break;case 6:addr=Mem2(cp);cp+=2;break;case 5:addr=Mem1(cp);cp++;break;default:fatal_error("Unknown addressing mode in store operand.");}
operands[ix]="1,"+addr;continue;}
else{fatal_error("Unknown operand type.",optype);}}
return cp;}
function compile_func(funcaddr){var addr=funcaddr;var functype=Mem1(addr);if(functype!=0xC0&&functype!=0xC1){if(functype>=0xC0&&functype<=0xDF)
fatal_error("Call to unknown type of function.",addr);else
fatal_error("Call to non-function.",addr);}
addr++;var localsformat=[];var rawstart=addr;var ix=0;while(1){var loctype=Mem1(addr);addr++;var locnum=Mem1(addr);addr++;if(loctype==0){break;}
if(loctype!=1&&loctype!=2&&loctype!=4){fatal_error("Invalid local variable size in function header.",loctype);}
localsformat.push({size:loctype,count:locnum});}
var rawformat=Array.from(memmap.slice(rawstart,addr));while(rawformat.length%4)
rawformat.push(0);return new VMFunc(funcaddr,addr,localsformat,rawformat);}
function compile_path(vmfunc,startaddr,startiosys){var cp=startaddr;var opcode;var opcodecp;var key;var context={vmfunc:vmfunc,cp:null,prevcp:null,curiosys:startiosys,code:[],holduse:{},varsused:{},offstack:[],offloc:[],offlocdirty:[],path_ends:false};var operands={};operands.func_store={};context.code.push("");while(!context.path_ends){context.prevcp=cp;opcodecp=cp;opcode=Mem1(cp);if(opcode===undefined)
fatal_error("Tried to compile nonexistent address",cp);cp++;if(opcode&0x80){if(opcode&0x40){opcode&=0x3F;opcode=(opcode*0x100)|Mem1(cp);cp++;opcode=(opcode*0x100)|Mem1(cp);cp++;opcode=(opcode*0x100)|Mem1(cp);cp++;}
else{opcode&=0x7F;opcode=(opcode*0x100)|Mem1(cp);cp++;}}
var oplist=operandlist_table[opcode];if(!oplist)
fatal_error("Encountered unknown opcode.",opcode);cp=parse_operands(context,cp,oplist,operands);context.cp=cp;var ophandler=opcode_table[opcode];if(!ophandler)
fatal_error("Encountered unhandled opcode.",opcode);ophandler(context,operands);for(key in context.holduse){if(context.holduse[key]===true)
context.holduse[key]=false;}
if(vmfunc.pathaddrs[cp]&&!context.path_ends){context.code.push("self.pc="+cp+";");oputil_unload_offstate(context);context.code.push("return;");context.path_ends=true;}}
if(context.offstack.length)
fatal_error("Path compilation ended with nonempty offstack.",context.offstack.length);if(context.offloc.length)
fatal_error("Path compilation ended with nonempty offloc.",context.offloc.length);{var ls=[];for(key in context.holduse)
ls.push(key);for(key in context.varsused)
ls.push(key);if(ls.length)
context.code[0]="var "+ls.join(",")+";";}
return make_code(context.code.join("\n"),"_func_path_"+startaddr);}
function enter_function(addr,argcount){var ix;total_function_calls++;var accelfunc=accel_address_map[addr];if(accelfunc!==undefined){accel_function_calls++;var val=accelfunc(argcount,self.tempcallargs);pop_callstub(val);return;}
var vmfunc=vmfunc_table[addr];if(vmfunc===undefined){vmfunc=compile_func(addr);if(addr<ramstart)
vmfunc_table[addr]=vmfunc;}
self.pc=vmfunc.startpc;var newframe=new StackFrame(vmfunc);newframe.depth=stack.length;if(stack.length==0)
newframe.framestart=0;else
newframe.framestart=self.frame.framestart+self.frame.framelen+4*self.frame.valstack.length;stack.push(newframe);self.frame=newframe;if(vmfunc.functype==0xC0){for(ix=argcount-1;ix>=0;ix--)
self.frame.valstack.push(self.tempcallargs[ix]);self.frame.valstack.push(argcount);}
else{for(ix=0;ix<argcount;ix++){var form=vmfunc.localsindex[ix];if(form===undefined)
break;if(form.size==4)
self.frame.locals[form.pos]=self.tempcallargs[ix];else if(form.size==2)
self.frame.locals[form.pos]=self.tempcallargs[ix]&0xFFFF;else if(form.size==1)
self.frame.locals[form.pos]=self.tempcallargs[ix]&0xFF;}}}
self.enter_function=enter_function;function leave_function(){var olddepth=self.frame.depth;stack.pop();if(stack.length==0){self.frame=null;return true;}
self.frame=stack[stack.length-1];if(self.frame.depth!=olddepth-1)
fatal_error("Stack inconsistent after function exit.");}
self.leave_function=leave_function;function pop_stack_to(val){while(stack.length&&stack[stack.length-1].framestart>val)
stack.pop();if(stack.length==0)
fatal_error("Stack evaporated during throw.");self.frame=stack[stack.length-1];val-=(self.frame.framestart+self.frame.framelen);if(val<0)
fatal_error("Attempted to throw below the frame value stack.");if(val&3)
fatal_error("Attempted to throw to an unaligned address.");val>>>=2;if(val>self.frame.valstack.length)
fatal_error("Attempted to throw beyond the frame value stack.");self.frame.valstack.length=val;}
self.pop_stack_to=pop_stack_to;function pop_callstub(val){var destaddr,desttype;if(isNaN(val))
fatal_error("Function returned undefined value.");var valstack=self.frame.valstack;var vallen=valstack.length;var framestart=valstack[vallen-1];if(framestart!=self.frame.framestart){valstack.length-=1;fatal_error("Call stub frameptr ("+framestart+") "+"does not match frame ("+self.frame.framestart+")");}
self.pc=valstack[vallen-2];destaddr=valstack[vallen-3];desttype=valstack[vallen-4];valstack.length-=4;switch(desttype){case 0:return;case 1:MemW4(destaddr,val);return;case 2:self.frame.locals[destaddr]=val;return;case 3:self.frame.valstack.push(val);return;case 0x11:fatal_error("String-terminator call stub at end of function call.");return;case 0x10:stream_string(0,self.pc,0xE1,destaddr);return;case 0x12:stream_num(0,self.pc,true,destaddr);return;case 0x13:stream_string(0,self.pc,0xE0,destaddr);return;case 0x14:stream_string(0,self.pc,0xE2,destaddr);return;default:fatal_error("Unrecognized desttype in callstub.",desttype);}}
self.pop_callstub=pop_callstub;function store_operand(desttype,destaddr,val){switch(desttype){case 0:return;case 1:MemW4(destaddr,val);return;case 2:self.frame.locals[destaddr]=val;return;case 3:self.frame.valstack.push(val);return;default:fatal_error("Unrecognized desttype in callstub.",desttype);}}
self.store_operand=store_operand;function store_operand_by_funcop(funcop,val){if(!funcop)
return;switch(funcop.mode){case 8:self.frame.valstack.push(val);return;case 0:return;case 11:if(funcop.argsize==4){self.frame.locals[funcop.addr]=(val);}
else if(funcop.argsize==2){self.frame.locals[funcop.addr]=(0xffff&val);}
else{self.frame.locals[funcop.addr]=(0xff&val);}
return;case 15:if(funcop.argsize==4){MemW4(funcop.addr,val);}
else if(funcop.argsize==2){MemW2(funcop.addr,val);}
else{MemW1(funcop.addr,val);}
return;default:fatal_error("Unknown addressing mode in store func by operand.");}}
function parse_partial_operand()
{var addr=self.prevpc;var opcode=Mem1(addr);addr++;if(opcode&0x80){if(opcode&0x40){opcode&=0x3F;opcode=(opcode<<8)|Mem1(addr);addr++;opcode=(opcode<<8)|Mem1(addr);addr++;opcode=(opcode<<8)|Mem1(addr);addr++;}
else{opcode&=0x7F;opcode=(opcode<<8)|Mem1(addr);addr++;}}
if(opcode!=0x130){qlog("parse_partial_operand: parsed wrong opcode: "+opcode);return null;}
return{selop:Mem1(addr)&0x0F,argsop:(Mem1(addr)>>4)&0x0F,resop:Mem1(addr+1)&0x0F};}
function set_random(val){if(val==0){self.random_func=native_random_func;}
else{xo_set_seed(val);self.random_func=xo_random_func;}}
self.set_random=set_random;function native_random_func(arg){if(arg>0)
return Math.floor(Math.random()*arg);else if(arg<0)
return-Math.floor(Math.random()*-arg);else
return(Math.floor(Math.random()*0x10000)|(Math.floor(Math.random()*0x10000)<<16))>>>0;}
function xo_random_func(arg){if(arg>0)
return xo_get_random()%arg;else if(arg<0)
return-(xo_get_random()%-arg);else
return xo_get_random();}
var xo_table=undefined;function xo_set_seed(seed){var ix,s;if(xo_table===undefined)
xo_table=new Uint32Array(4);seed=(seed>>>0);for(ix=0;ix<4;ix++){seed=(seed+0x9E3779B9)>>>0;s=seed;s=(s^(s>>>15))>>>0;s=Math.imul(s,0x85EBCA6B)>>>0;s=(s^(s>>>13))>>>0;s=Math.imul(s,0xC2B2AE35)>>>0;s=(s^(s>>>16))>>>0;xo_table[ix]=s;}}
function xo_get_random(){var t1x5=Math.imul(xo_table[1],5)>>>0;var result=Math.imul(((t1x5<<7)|(t1x5>>>(32-7))),9)>>>0;var t1s9=(xo_table[1]<<9)>>>0;xo_table[2]=(xo_table[2]^xo_table[0]);xo_table[3]=(xo_table[3]^xo_table[1]);xo_table[1]=(xo_table[1]^xo_table[2]);xo_table[0]=(xo_table[0]^xo_table[3]);xo_table[2]=(xo_table[2]^t1s9);var t3=xo_table[3];xo_table[3]=((t3<<11)|(t3>>>(32-11)));return result>>>0;}
var accel_address_map={};var accel_funcnum_map={};self.accel_address_map=accel_address_map;self.accel_funcnum_map=accel_funcnum_map;var accel_params=[0,0,0,0,0,0,0,0,0];self.accel_params=accel_params;function accel_print_error(msg){if(self.iosysmode==2){self.Glk.glk_put_jstring(msg);};}
var accel_func_map={1:function func_1_z__region(argc,argv){if(argc<1)
return 0;var addr=argv[0];if(addr<36)
return 0;if(addr>=self.endmem)
return 0;var tb=Mem1(addr);if(tb>=0xE0){return 3;}
if(tb>=0xC0){return 2;}
if(tb>=0x70&&tb<=0x7F&&addr>=ramstart){return 1;}
return 0;},2:function func_2_cp__tab(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);if(accel_func_map[1](argc,argv)!=1){accel_print_error("\n[** Programming error: tried to find the \".\" of (something) **]\n");return 0;}
var otab=Mem4(obj+16);if(!otab)
return 0;var max=Mem4(otab);otab+=4;return binary_search(id,2,otab,10,max,0,0);},3:function func_3_ra__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var prop=accel_helper_get_prop(obj,id);if(prop==0)
return 0;return Mem4(prop+4);},4:function func_4_rl__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var prop=accel_helper_get_prop(obj,id);if(prop==0)
return 0;return 4*Mem2(prop+2);},5:function func_5_oc__cl(argc,argv){var zr,prop,inlist,inlistlen,jx;var obj=((argc>0)?argv[0]:0);var cla=((argc>1)?argv[1]:0);zr=accel_func_map[1](argc,argv);if(zr==3)
return(cla==accel_params[5])?1:0;if(zr==2)
return(cla==accel_params[4])?1:0;if(zr!=1)
return 0;if(cla==accel_params[2]){if(accel_helper_obj_in_class(obj))
return 1;if(obj==accel_params[2])
return 1;if(obj==accel_params[5])
return 1;if(obj==accel_params[4])
return 1;if(obj==accel_params[3])
return 1;return 0;}
if(cla==accel_params[3]){if(accel_helper_obj_in_class(obj))
return 0;if(obj==accel_params[2])
return 0;if(obj==accel_params[5])
return 0;if(obj==accel_params[4])
return 0;if(obj==accel_params[3])
return 0;return 1;}
if((cla==accel_params[5])||(cla==accel_params[4]))
return 0;if(!accel_helper_obj_in_class(cla)){accel_print_error("\n[** Programming error: tried to apply 'ofclass' with non-class **]\n");return 0;}
prop=accel_helper_get_prop(obj,2);if(prop==0)
return 0;inlist=Mem4(prop+4);if(inlist==0)
return 0;inlistlen=Mem2(prop+2);for(jx=0;jx<inlistlen;jx++){if(Mem4(inlist+(4*jx))==cla)
return 1;}
return 0;},6:function func_6_rv__pr(argc,argv){var id=((argc>1)?argv[1]:0);var addr;addr=accel_func_map[3](argc,argv);if(addr==0){if((id>0)&&(id<accel_params[1])){return Mem4(accel_params[8]+(4*id));}
accel_print_error("\n[** Programming error: tried to read (something) **]\n");return 0;}
return Mem4(addr);},7:function func_7_op__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var indiv_prop_start=accel_params[1];var zr=accel_func_map[1](argc,argv);if(zr==3){if(id==indiv_prop_start+6)
return 1;if(id==indiv_prop_start+7)
return 1;return 0;}
if(zr==2){return((id==indiv_prop_start+5)?1:0);}
if(zr!=1)
return 0;if((id>=indiv_prop_start)&&(id<indiv_prop_start+8)){if(accel_helper_obj_in_class(obj))
return 1;}
return((accel_func_map[3](argc,argv))?1:0);},8:function func_8_cp__tab(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);if(accel_func_map[1](argc,argv)!=1){accel_print_error("\n[** Programming error: tried to find the \".\" of (something) **]\n");return 0;}
var otab=Mem4(obj+4*(3+(accel_params[7]>>2)));if(!otab)
return 0;var max=Mem4(otab);otab+=4;return binary_search(id,2,otab,10,max,0,0);},9:function func_9_ra__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var prop=accel_helper_get_prop_new(obj,id);if(prop==0)
return 0;return Mem4(prop+4);},10:function func_10_rl__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var prop=accel_helper_get_prop_new(obj,id);if(prop==0)
return 0;return 4*Mem2(prop+2);},11:function func_11_oc__cl(argc,argv){var zr,prop,inlist,inlistlen,jx;var obj=((argc>0)?argv[0]:0);var cla=((argc>1)?argv[1]:0);zr=accel_func_map[1](argc,argv);if(zr==3)
return(cla==accel_params[5])?1:0;if(zr==2)
return(cla==accel_params[4])?1:0;if(zr!=1)
return 0;if(cla==accel_params[2]){if(accel_helper_obj_in_class(obj))
return 1;if(obj==accel_params[2])
return 1;if(obj==accel_params[5])
return 1;if(obj==accel_params[4])
return 1;if(obj==accel_params[3])
return 1;return 0;}
if(cla==accel_params[3]){if(accel_helper_obj_in_class(obj))
return 0;if(obj==accel_params[2])
return 0;if(obj==accel_params[5])
return 0;if(obj==accel_params[4])
return 0;if(obj==accel_params[3])
return 0;return 1;}
if((cla==accel_params[5])||(cla==accel_params[4]))
return 0;if(!accel_helper_obj_in_class(cla)){accel_print_error("\n[** Programming error: tried to apply 'ofclass' with non-class **]\n");return 0;}
prop=accel_helper_get_prop_new(obj,2);if(prop==0)
return 0;inlist=Mem4(prop+4);if(inlist==0)
return 0;inlistlen=Mem2(prop+2);for(jx=0;jx<inlistlen;jx++){if(Mem4(inlist+(4*jx))==cla)
return 1;}
return 0;},12:function func_12_rv__pr(argc,argv){var id=((argc>1)?argv[1]:0);var addr;addr=accel_func_map[9](argc,argv);if(addr==0){if((id>0)&&(id<accel_params[1])){return Mem4(accel_params[8]+(4*id));}
accel_print_error("\n[** Programming error: tried to read (something) **]\n");return 0;}
return Mem4(addr);},13:function func_13_op__pr(argc,argv){var obj=((argc>0)?argv[0]:0);var id=((argc>1)?argv[1]:0);var indiv_prop_start=accel_params[1];var zr=accel_func_map[1](argc,argv);if(zr==3){if(id==indiv_prop_start+6)
return 1;if(id==indiv_prop_start+7)
return 1;return 0;}
if(zr==2){return((id==indiv_prop_start+5)?1:0);}
if(zr!=1)
return 0;if((id>=indiv_prop_start)&&(id<indiv_prop_start+8)){if(accel_helper_obj_in_class(obj))
return 1;}
return((accel_func_map[9](argc,argv))?1:0);}};self.accel_func_map=accel_func_map;var accel_helper_temp_args=[0,0];function accel_helper_obj_in_class(obj)
{return(Mem4(obj+13+accel_params[7])==accel_params[2]);}
function accel_helper_get_prop(obj,id)
{var cla=0;var prop;if(id&0xFFFF0000){cla=Mem4(accel_params[0]+((id&0xFFFF)*4));accel_helper_temp_args[0]=obj;accel_helper_temp_args[1]=cla;if(accel_func_map[5](2,accel_helper_temp_args)==0)
return 0;id=id>>16;obj=cla;}
accel_helper_temp_args[0]=obj;accel_helper_temp_args[1]=id;prop=accel_func_map[2](2,accel_helper_temp_args);if(prop==0)
return 0;if(accel_helper_obj_in_class(obj)&&(cla==0)){if((id<accel_params[1])||(id>=accel_params[1]+8))
return 0;}
if(Mem4(accel_params[6])!=obj){if(Mem1(prop+9)&1)
return 0;}
return prop;}
function accel_helper_get_prop_new(obj,id)
{var cla=0;var prop;if(id&0xFFFF0000){cla=Mem4(accel_params[0]+((id&0xFFFF)*4));accel_helper_temp_args[0]=obj;accel_helper_temp_args[1]=cla;if(accel_func_map[11](2,accel_helper_temp_args)==0)
return 0;id=id>>16;obj=cla;}
accel_helper_temp_args[0]=obj;accel_helper_temp_args[1]=id;prop=accel_func_map[8](2,accel_helper_temp_args);if(prop==0)
return 0;if(accel_helper_obj_in_class(obj)&&(cla==0)){if((id<accel_params[1])||(id>=accel_params[1]+8))
return 0;}
if(Mem4(accel_params[6])!=obj){if(Mem1(prop+9)&1)
return 0;}
return prop;}
function set_string_table(addr){if(self.stringtable==addr)
return;decoding_tree=undefined;vmstring_table=undefined;self.stringtable=addr;if(self.stringtable==0){return;}
var textenv=vmtextenv_table[self.stringtable];if(textenv===undefined){var dectab=undefined;var tablelen=Mem4(self.stringtable);var rootaddr=Mem4(self.stringtable+8);var cache_stringtable=(self.stringtable+tablelen<=ramstart);if(cache_stringtable){var tmparray=Array(1);build_decoding_tree(tmparray,rootaddr,4,0);dectab=tmparray[0];if(dectab===undefined)
fatal_error("Failed to create decoding tree.");}
textenv=new VMTextEnv(self.stringtable,dectab);vmtextenv_table[self.stringtable]=textenv;}
decoding_tree=textenv.decoding_tree;vmstring_table=textenv.vmstring_tables[self.iosysmode];}
self.set_string_table=set_string_table;function set_iosys(mode,rock){switch(mode){case 0:rock=0;break;case 1:break;case 2:rock=0;break;default:mode=0;rock=0;break;}
self.iosysmode=mode;self.iosysrock=rock;var textenv=vmtextenv_table[self.stringtable];if(textenv===undefined)
vmstring_table=undefined;else
vmstring_table=textenv.vmstring_tables[self.iosysmode];}
self.set_iosys=set_iosys;function build_decoding_tree(cablist,nodeaddr,depth,mask){var ix,type,cab;var depthbit;type=Mem1(nodeaddr);if(type==0&&depth==4){cab=Array(16);cab.type=0;cab.depth=4;cablist[mask]=cab;build_decoding_tree(cab,nodeaddr,0,0);return;}
if(type==0){var leftaddr=Mem4(nodeaddr+1);var rightaddr=Mem4(nodeaddr+5);build_decoding_tree(cablist,leftaddr,depth+1,mask);build_decoding_tree(cablist,rightaddr,depth+1,(mask|(1<<depth)));return;}
nodeaddr++;cab={};cab.type=type;cab.depth=depth;switch(type){case 0x02:cab.value=Mem1(nodeaddr);cab.cchar=CharToString(cab.value);break;case 0x04:cab.value=Mem4(nodeaddr);cab.cchar=CharToString(cab.value);break;case 0x03:case 0x05:cab.addr=nodeaddr;break;case 0x08:case 0x09:cab.addr=Mem4(nodeaddr);break;case 0x0A:case 0x0B:cab.addr=nodeaddr;break;case 0x01:break;default:fatal_error("Unknown node type in string table.",type);}
depthbit=(1<<depth);for(ix=mask;ix<16;ix+=depthbit){cablist[ix]=cab;}}
function stream_num(nextcp,value,inmiddle,charnum){var buf=(value&0xffffffff).toString(10);switch(self.iosysmode){case 2:if(charnum)
buf=buf.slice(charnum);self.Glk.glk_put_jstring(buf,true);break;case 1:if(!inmiddle){self.frame.valstack.push(0x11,0,nextcp,self.frame.framestart);inmiddle=true;}
if(charnum<buf.length){var ch=buf.charCodeAt(charnum);self.frame.valstack.push(0x12,charnum+1,value,self.frame.framestart);self.tempcallargs[0]=ch;enter_function(self.iosysrock,1);return true;}
break;case 0:break;}
if(inmiddle){var desttype,destaddr;if(self.frame.valstack.pop()!=self.frame.framestart)
fatal_error("Call stub frameptr does not match frame.");self.pc=self.frame.valstack.pop();destaddr=self.frame.valstack.pop();desttype=self.frame.valstack.pop();if(desttype!=0x11)
fatal_error("String-on-string call stub while printing number.");}}
self.stream_num=stream_num;function stream_string(nextcp,addr,inmiddle,bitnum){var substring=(inmiddle!=0);var addrkey,strop,res;var desttype,destaddr;while(true){strop=undefined;if(inmiddle==0)
addrkey=addr;else
addrkey=addr+"/"+inmiddle+"/"+bitnum;if(vmstring_table!==undefined&&addr<ramstart){strop=vmstring_table[addrkey];if(strop===undefined){strop=compile_string(self.iosysmode,addr,inmiddle,bitnum);vmstring_table[addrkey]=strop;strings_compiled++;strings_cached++;}}
else{strop=compile_string(self.iosysmode,addr,inmiddle,bitnum);strings_compiled++;}
if(!(strop instanceof Function)){if(strop.length!=0)
self.Glk.glk_put_jstring(strop);if(!substring)
return false;}
else{res=strop(self,nextcp,substring);if(res instanceof Array){substring=true;addr=res[0];inmiddle=res[1];bitnum=res[2];continue;}
if(res){return true;}}
if(self.frame.valstack.pop()!=self.frame.framestart)
fatal_error("Call stub frameptr does not match frame.");self.pc=self.frame.valstack.pop();destaddr=self.frame.valstack.pop();desttype=self.frame.valstack.pop();if(desttype==0x11){return true;}
else if(desttype==0x10){substring=true;bitnum=destaddr;inmiddle=0xE1;addr=self.pc;}
else{fatal_error("Function-terminator call stub at end of string.");}}}
self.stream_string=stream_string;function compile_string(curiosys,startaddr,inmiddle,startbitnum){var addr=startaddr;var bitnum=startbitnum;var retval=undefined;var ch,type;if(!addr)
fatal_error("Called compile_string with null address.");var context={startaddr:startaddr,startbitnum:startbitnum,buffer:[],code:[]}
if(inmiddle==0){type=Mem1(addr);if(type==0xE2)
addr+=4;else
addr++;bitnum=0;}
else{type=inmiddle;}
if(type==0xE1){if(decoding_tree){var bits,numbits,readahead,tmpaddr;var cablist,cab;var done=false;bits=Mem1(addr);if(bitnum)
bits>>=bitnum;numbits=(8-bitnum);readahead=false;if(!(decoding_tree instanceof Array)){done=true;}
cablist=decoding_tree;while(!done){if(numbits<4){var newbyte=Mem1(addr+1);bits|=(newbyte<<numbits);numbits+=8;readahead=true;}
cab=cablist[bits&0x0F];numbits-=cab.depth;bits>>=cab.depth;bitnum+=cab.depth;if(bitnum>=8){addr+=1;bitnum-=8;if(readahead){readahead=false;}
else{var newbyte=Mem1(addr);bits|=(newbyte<<numbits);numbits+=8;}}
if(cab instanceof Array){cablist=cab;continue;}
switch(cab.type){case 0x01:done=true;break;case 0x02:case 0x04:switch(curiosys){case 2:context.buffer.push(cab.cchar);break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);context.code.push("self.tempcallargs[0]="+cab.value+";");context.code.push("self.enter_function(self.iosysrock, 1);");retval=true;done=true;break;}
cablist=decoding_tree;break;case 0x03:switch(curiosys){case 2:tmpaddr=cab.addr;while(true){ch=Mem1(tmpaddr);if(ch==0)
break;context.buffer.push(CharToString(ch));tmpaddr++;}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);retval="["+(cab.addr)+", 0xE0, 0]";done=true;break;}
cablist=decoding_tree;break;case 0x05:switch(curiosys){case 2:tmpaddr=cab.addr;while(true){ch=Mem4(tmpaddr);if(ch==0)
break;context.buffer.push(CharToString(ch));tmpaddr+=4;}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);retval="["+(cab.addr)+", 0xE2, 0]";done=true;break;}
cablist=decoding_tree;break;case 0x08:case 0x09:case 0x0A:case 0x0B:oputil_flush_string(context);oputil_push_substring_callstub(context);context.code.push("var otype, retval;");context.code.push("var oaddr = "+(cab.addr)+";");if(cab.type>=0x09)
context.code.push("oaddr = self.Mem4(oaddr);");if(cab.type==0x0B)
context.code.push("oaddr = self.Mem4(oaddr);");context.code.push("otype = self.Mem1(oaddr);");retval="retval";done=true;oputil_push_callstub(context,"0x10,"+bitnum,addr);context.code.push("if (otype >= 0xE0 && otype <= 0xFF) {");context.code.push("retval = [oaddr, 0, 0];");context.code.push("}");context.code.push("else if (otype >= 0xC0 && otype <= 0xDF) {");var argc=0;if(cab.type==0x0A||cab.type==0x0B){argc=Mem4(cab.addr+4);for(var ix=0;ix<argc;ix++)
context.code.push("self.tempcallargs["+ix+"]="+Mem4(cab.addr+8+4*ix)+";");}
context.code.push("self.enter_function(oaddr, "+argc+");");context.code.push("retval = true;");context.code.push("}");context.code.push("else {");context.code.push("self.fatal_error('Unknown object while decoding string indirect reference.', otype);");context.code.push("}");break;default:fatal_error("Unknown entity in string decoding (cached).");break;}}}
else{var node,byt,nodetype;var done=false;if(!self.stringtable)
fatal_error("Attempted to print a compressed string with no table set.");byt=Mem1(addr);if(bitnum)
byt>>=bitnum;node=Mem4(self.stringtable+8);while(!done){nodetype=Mem1(node);node++;switch(nodetype){case 0x00:if(byt&1)
node=Mem4(node+4);else
node=Mem4(node+0);if(bitnum==7){bitnum=0;addr++;byt=Mem1(addr);}
else{bitnum++;byt>>=1;}
break;case 0x01:retval=false;done=true;break;case 0x02:ch=Mem1(node);switch(curiosys){case 2:context.buffer.push(CharToString(ch));break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);context.code.push("self.tempcallargs[0]="+ch+";");context.code.push("self.enter_function(self.iosysrock, 1);");retval=true;done=true;break;}
node=Mem4(self.stringtable+8);break;case 0x04:ch=Mem4(node);switch(curiosys){case 2:context.buffer.push(CharToString(ch));break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);context.code.push("self.tempcallargs[0]="+ch+";");context.code.push("self.enter_function(self.iosysrock, 1);");retval=true;done=true;break;}
node=Mem4(self.stringtable+8);break;case 0x03:switch(curiosys){case 2:while(true){ch=Mem1(node);if(ch==0)
break;context.buffer.push(CharToString(ch));node++;}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);retval="["+node+", 0xE0, 0]";done=true;break;}
node=Mem4(self.stringtable+8);break;case 0x05:switch(curiosys){case 2:while(true){ch=Mem4(node);if(ch==0)
break;context.buffer.push(CharToString(ch));node+=4;}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);oputil_push_callstub(context,"0x10,"+bitnum,addr);retval="["+node+", 0xE2, 0]";done=true;break;}
node=Mem4(self.stringtable+8);break;case 0x08:case 0x09:case 0x0A:case 0x0B:oputil_flush_string(context);oputil_push_substring_callstub(context);context.code.push("var otype, retval;");context.code.push("var oaddr = "+Mem4(node)+";");if(nodetype==0x09||nodetype==0x0B)
context.code.push("oaddr = self.Mem4(oaddr);");context.code.push("otype = self.Mem1(oaddr);");retval="retval";done=true;oputil_push_callstub(context,"0x10,"+bitnum,addr);context.code.push("if (otype >= 0xE0 && otype <= 0xFF) {");context.code.push("retval = [oaddr, 0, 0];");context.code.push("}");context.code.push("else if (otype >= 0xC0 && otype <= 0xDF) {");var argc=0;if(nodetype==0x0A||nodetype==0x0B){argc=Mem4(node+4);for(var ix=0;ix<argc;ix++)
context.code.push("self.tempcallargs["+ix+"]="+Mem4(node+8+4*ix)+";");}
context.code.push("self.enter_function(oaddr, "+argc+");");context.code.push("retval = true;");context.code.push("}");context.code.push("else {");context.code.push("self.fatal_error('Unknown object while decoding string indirect reference.', otype);");context.code.push("}");break;default:fatal_error("Unknown entity in string decoding.",nodetype);break;}}}}
else if(type==0xE0){var ch;switch(curiosys){case 2:while(1){ch=Mem1(addr);addr++;if(ch==0)
break;context.buffer.push(CharToString(ch));}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);ch=Mem1(addr);addr++;if(ch!=0){oputil_push_callstub(context,"0x13,0",addr);context.code.push("self.tempcallargs[0]="+ch+";");context.code.push("self.enter_function(self.iosysrock, 1);");retval=true;}
else{retval="false";}
break;}}
else if(type==0xE2){var ch;switch(curiosys){case 2:while(1){ch=Mem4(addr);addr+=4;if(ch==0)
break;context.buffer.push(CharToString(ch));}
break;case 1:oputil_flush_string(context);oputil_push_substring_callstub(context);ch=Mem4(addr);addr+=4;if(ch!=0){oputil_push_callstub(context,"0x14,0",addr);context.code.push("self.tempcallargs[0]="+ch+";");context.code.push("self.enter_function(self.iosysrock, 1);");retval=true;}
else{retval="false";}
break;}}
else if(type>=0xE0&&type<=0xFF){fatal_error("Attempt to print unknown type of string.");}
else{fatal_error("Attempt to print non-string.");}
if(!retval){return context.buffer.join("");}
else{oputil_flush_string(context);context.code.push("return "+retval+";");return make_code(context.code.join("\n"),"_func_str_"+startaddr,"nextcp","substring");}}
function do_gestalt(val,val2){var ix;switch(val){case 0:return 0x00030103;case 1:return 0x00020206;case 2:return 1;case 3:return 1;case 4:switch(val2){case 0:return 1;case 1:return 1;case 2:return 1;default:return 0;}
break;case 5:return 1;case 6:return 1;case 7:return 1;case 8:return heap_get_start();case 9:return 1;case 10:if(accel_func_map[val2])
return 1;else
return 0;case 11:return 1;case 12:return 1;case 13:return 1;default:return 0;}}
self.do_gestalt=do_gestalt;function fetch_search_key(addr,len,options){var ix;if(options&1){return MemSlice(addr,len);}
else{switch(len){case 4:return[(addr>>24)&0xFF,(addr>>16)&0xFF,(addr>>8)&0xFF,addr&0xFF];case 2:return[(addr>>8)&0xFF,addr&0xFF];case 1:return[addr&0xFF];default:fatal_error('Direct search key must hold one, two, or four bytes.');}}}
function linear_search(key,keysize,start,structsize,numstructs,keyoffset,options){var ix,count,match,bytes;var retindex=((options&4)!=0);var zeroterm=((options&2)!=0);var keybuf=fetch_search_key(key,keysize,options);for(count=0;count<numstructs;count++,start+=structsize){match=true;bytes=MemSlice(start+keyoffset,keysize);for(ix=0;match&&ix<keysize;ix++){if(bytes[ix]!=keybuf[ix])
match=false;}
if(match){if(retindex)
return count;else
return start;}
if(zeroterm){match=true;bytes=MemSlice(start+keyoffset,keysize);for(ix=0;match&&ix<keysize;ix++){if(bytes[ix]!=0)
match=false;}
if(match){break;}}}
if(retindex)
return 0xFFFFFFFF;else
return 0;}
function binary_search(key,keysize,start,structsize,numstructs,keyoffset,options){var top,bot,addr,val,cmp,ix;var byt,byt2;var retindex=((options&4)!=0);var keybuf=fetch_search_key(key,keysize,options);bot=0;top=numstructs;while(bot<top){cmp=0;val=(top+bot)>>1;addr=start+val*structsize;for(ix=0;(!cmp)&&ix<keysize;ix++){byt=Mem1(addr+keyoffset+ix);byt2=keybuf[ix];if(byt<byt2)
cmp=-1;else if(byt>byt2)
cmp=1;}
if(!cmp){if(retindex)
return val;else
return addr;}
if(cmp<0){bot=val+1;}
else{top=val;}}
if(retindex)
return 0xFFFFFFFF;else
return 0;}
function linked_search(key,keysize,start,keyoffset,nextoffset,options){var ix,byt,match;var zeroterm=((options&2)!=0);var keybuf=fetch_search_key(key,keysize,options);while(start!=0){match=true;for(ix=0;match&&ix<keysize;ix++){byt=Mem1(start+keyoffset+ix);if(byt!=keybuf[ix])
match=false;}
if(match){return start;}
if(zeroterm){match=true;for(ix=0;match&&ix<keysize;ix++){byt=Mem1(start+keyoffset+ix);if(byt!=0)
match=false;}
if(match){break;}}
start=Mem4(start+nextoffset);}
return 0;}
self.linear_search=linear_search;self.binary_search=binary_search;self.linked_search=linked_search;function decode_float(val){var sign,res,expo;if(val&0x80000000){sign=true;val=val&0x7fffffff;}
else{sign=false;}
if(val==0){return(sign?-0.0:0.0);}
if((val&0x7f800000)==0x7f800000){if((val&0x7fffff)==0){return(sign?-Infinity:Infinity);}
else{return(sign?-NaN:NaN);}}
expo=(val>>23&0xff);if(expo){res=((val&0x7fffff|0x800000)/8388608*Math.pow(2,(expo-127)));}
else{res=((val&0x7fffff)/8388608*Math.pow(2,-126));}
if(sign)
return-res;else
return res;}
function encode_float(val){var absval,fbits;var mant,expo,sign;if(isNaN(val)){return 0x7f800001;}
if(!isFinite(val)){if(val<0)
return 0xff800000;else
return 0x7f800000;}
if(val==0){if(1/val<0)
return 0x80000000;else
return 0x0;}
if(val<0){sign=true;absval=-val;}
else{sign=false;absval=val;}
expo=Math.floor(Math.log(absval)/Math.log(2));mant=absval/Math.pow(2,expo);if(expo>=128){return(sign?0xff800000:0x7f800000);}
else if(expo<-126){mant=mant*Math.pow(2,126+expo);expo=0;}
else if(!(expo==0&&mant==0.0)){expo+=127;mant-=1.0;}
mant=mant*8388608.0;fbits=(mant+0.4999999999999999)<<0;if(fbits>=8388608){fbits=0;expo++;if(expo>=255){return(sign?0xff800000:0x7f800000);}}
if(sign)
return((0x80000000)|(expo<<23)|(fbits))>>>0;else
return(expo<<23)|(fbits);}
function decode_double(valhi,vallo){var sign,res,expo,manthi,mantlo;if(valhi&0x80000000){sign=true;valhi=valhi&0x7fffffff;}
else{sign=false;}
if(valhi==0&&vallo==0){return(sign?-0.0:0.0);}
expo=(valhi>>20)&0x7ff;manthi=valhi&0xfffff;mantlo=vallo;if(expo==2047){if(manthi==0&&mantlo==0){return(sign?-Infinity:Infinity);}
else{return(sign?-NaN:NaN);}}
res=mantlo/4503599627370496.0+manthi/1048576.0;if(expo){res=(res+1)*Math.pow(2,(expo-1023));}
else{res=res*Math.pow(2,-1022);}
return(sign?-res:res);}
function encode_double(val){var absval,fhi,flo;var mant,expo,sign;var valhi,vallo;if(isNaN(val)){return{hi:0x7FF80000,lo:0x00000001};}
if(!isFinite(val)){if(val<0)
return{hi:0xFFF00000,lo:0x0};else
return{hi:0x7FF00000,lo:0x0};}
if(val==0){if(1/val<0)
return{hi:0x80000000,lo:0x0};else
return{hi:0x00000000,lo:0x0};}
if(val<0){sign=true;absval=-val;}
else{sign=false;absval=val;}
expo=Math.floor(Math.log(absval)/Math.log(2));if(expo==1024){expo--;}
else if(expo>=1024){return(sign?0xff800000:0x7f800000);}
mant=absval/Math.pow(2,expo);if(0.5<=mant&&mant<1.0){mant*=2.0;expo--;}
else if(mant>=2.0){mant*=0.5;expo++;}
else if(mant==0.0){expo=0;}
if(expo<-1022){mant=mant*Math.pow(2,1022+expo);expo=0;}
else if(!(expo==0&&mant==0.0)){expo+=1023;mant-=1.0;}
mant*=268435456.0;fhi=mant<<0;mant-=fhi;mant*=16777216.0;flo=(mant+0.5)<<0;if(flo>>24){flo=0;fhi++;if(fhi>>28){fhi=0;expo++;if(expo>=255){return(sign?0xff800000:0x7f800000);}}}
valhi=((sign?0x80000000:0x00000000)|(expo<<20)|(fhi>>8))>>>0;vallo=(((fhi&0xFF)<<24)|(flo))>>>0;return{hi:valhi,lo:vallo};}
self.decode_float=decode_float;self.encode_float=encode_float;self.decode_double=decode_double;self.encode_double=encode_double;var game_image=null;var game_signature=null;var opt_log_execution_time=null;var opt_rethrow_exceptions=null;var opt_do_vm_autosave=null;var opt_clear_vm_autosave=null;var memmap;var stack;self.frame=null;self.vm_started=false;self.vm_stopped=false;self.tempcallargs=null;self.tempglkargs=null;self.done_executing=null;var vmfunc_table;var vmtextenv_table;var decoding_tree;var vmstring_table;self.random_func=null;var ramstart;var endgamefile;var origendmem;var stacksize;var startfuncaddr;var origstringtable;var checksum;self.pc=null;self.stringtable=null;self.endmem=null;self.protectstart=null;self.protectend=null;self.iosysmode=null;self.iosysrock=null;self.prevpc=null;var undostack;self.resumefuncop=null;self.resumevalue=null;var heapstart;var usedlist;var freelist;var total_execution_time=0;var total_function_calls=0;var accel_function_calls=0;var total_path_calls=0;var paths_cached=0;var paths_compiled=0;var strings_cached=0;var strings_compiled=0;function setup_vm(){var val,version;if(!game_image)
fatal_error("There is no Glulx game file loaded.");var Dialog=self.Glk.getlibrary('Dialog');self.vm_started=true;self.resumefuncop=null;self.resumevalue=0;memmap=null;stack=[];self.frame=null;self.pc=0;self.prevpc=0;if(game_image.length<36)
fatal_error("This is too short to be a valid Glulx file.");val=ByteRead4(game_image,0);if(val!=0x476c756c)
fatal_error("This is not a valid Glulx file.");version=ByteRead4(game_image,4);if(version<0x20000)
fatal_error("This Glulx file is too old a version to execute.");if(version>=0x30200)
fatal_error("This Glulx file is too new a version to execute.");ramstart=ByteRead4(game_image,8);endgamefile=ByteRead4(game_image,12);origendmem=ByteRead4(game_image,16);stacksize=ByteRead4(game_image,20);startfuncaddr=ByteRead4(game_image,24);origstringtable=ByteRead4(game_image,28);checksum=ByteRead4(game_image,32);self.protectstart=0;self.protectend=0;if(ramstart<0x100||endgamefile<ramstart||origendmem<endgamefile)
fatal_error("The segment boundaries in the header are in an impossible order.");if(endgamefile!=game_image.length)
fatal_error("The game file length does not agree with the header.");self.done_executing=false;vmfunc_table={};vmtextenv_table={};decoding_tree=undefined;vmstring_table=undefined;self.tempcallargs=Array(8);self.tempglkargs=Array(8);set_random(0);self.endmem=origendmem;self.stringtable=0;undostack=[];heapstart=0;usedlist=[];freelist=[];if(opt_clear_vm_autosave){Dialog.autosave_write(game_signature,null);}
if(opt_do_vm_autosave&&!opt_clear_vm_autosave){try{var snapshot=Dialog.autosave_read(game_signature);if(snapshot){qlog('Found autosave...');vm_autorestore(snapshot);return;}}
catch(ex){qlog('Autorestore failed, deleting it: '+show_exception(ex));if(ex.stack)
qlog('JS stack dump C:\n'+ex.stack);Dialog.autosave_write(game_signature,null);}}
vm_restart();}
function vm_restart(){var ix;heap_clear();var protect=copy_protected_range();memmap=null;memmap=new Uint8Array(game_image);self.endmem=memmap.length;change_memsize(origendmem,false);paste_protected_range(protect);stack=[];self.frame=null;self.pc=0;self.prevpc=0;self.iosysmode=0;self.iosysrock=0;set_string_table(origstringtable);enter_function(startfuncaddr,0);}
self.vm_restart=vm_restart;function compress_bytes(arr){var result=[];var i=0;while(i<arr.length){var zeroes=0;while(i<arr.length&&arr[i]==0&&zeroes<=255){zeroes++;i++;}
if(zeroes>0){result.push(0);result.push(zeroes-1);}
while(i<arr.length&&arr[i]!=0){result.push(arr[i]);i++;}}
return result;}
function decompress_bytes(arr){var result=[];var i=0;while(i<arr.length){var b=arr[i++];if(b==0){var count=arr[i++]+1;for(var j=0;j<count;j++){result.push(0);}}else{result.push(b);}}
return result;}
function pack_iff_chunks(chunks){var bytes=[];for(var ix=0;ix<chunks.length;ix++){var key=chunks[ix].key;var chunk=chunks[ix].chunk;if(key.length!=4){fatal_error("Bad chunk ID (must be exactly 4 chars): "+key);}
if(chunk==undefined){fatal_error("Missing chunk data: "+key);}
BytePushString(bytes,key);BytePush4(bytes,chunk.length);bytes=bytes.concat(chunk);if(bytes.length&1)
bytes.push(0);}
return bytes;}
function unpack_iff_chunks(bytes){var chunks={};var pos=0;while(pos<bytes.length){if((pos+8)>bytes.length){qlog("IFF chunk header is truncated");return undefined;}
var key=ByteReadString(bytes,pos,4);var size=ByteRead4(bytes,pos+4);pos+=8;if((pos+size)>bytes.length){qlog(key+" chunk is truncated "+"("+size+" bytes needed, "+(bytes.length-pos)+" available");return undefined;}
chunks[key]=bytes.slice(pos,pos+size);pos+=size;if(pos&1)
pos+=1;}
return chunks;}
function vm_save(streamid){if(self.iosysmode!=2)
fatal_error("Streams are only available in Glk I/O system.");var str=self.GiDispa.class_obj_from_id('stream',streamid);if(!str)
return false;var chunks=[];chunks.push({key:"IFhd",chunk:Array.from(game_image.slice(0,128))});var cmem=memmap.slice(ramstart);for(var i=ramstart;i<game_image.length;i++){cmem[i-ramstart]^=game_image[i];}
cmem=compress_bytes(cmem);cmem.splice(0,0,0,0,0,0);ByteWrite4(cmem,0,self.endmem);chunks.push({key:"CMem",chunk:cmem});var stkschunk=[];chunks.push({key:"Stks",chunk:stkschunk});for(var i=0;i<stack.length;i++){push_serialized_stackframe(stack[i],stkschunk);}
if(heap_is_active()){var mallchunk=[];chunks.push({key:"MAll",chunk:mallchunk});BytePush4(mallchunk,heapstart);BytePush4(mallchunk,usedlist.length);for(var i=0;i<usedlist.length;i++){BytePush4(mallchunk,usedlist[i].addr);BytePush4(mallchunk,usedlist[i].size);}}
var payload_bytes=[]
BytePushString(payload_bytes,"IFZS");payload_bytes=payload_bytes.concat(pack_iff_chunks(chunks));var quetzal=pack_iff_chunks([{key:"FORM",chunk:payload_bytes}])
self.Glk.glk_put_buffer_stream(str,quetzal);return true;}
function vm_restore(streamid){if(self.iosysmode!=2)
fatal_error("Streams are only available in Glk I/O system.");var str=self.GiDispa.class_obj_from_id('stream',streamid);if(!str)
return false;var quetzal=new Array(0);var buffer=new Array(1024);var count=1;while(count>0){count=self.Glk.glk_get_buffer_stream(str,buffer);quetzal=quetzal.concat(buffer.slice(0,count));}
quetzal=unpack_iff_chunks(quetzal);if(!quetzal){qlog("vm_restore failed: file is not Quetzal");return false;}
quetzal=quetzal["FORM"];if(!quetzal||ByteReadString(quetzal,0,4)!="IFZS"){qlog("vm_restore failed: file doesn't start with FORM/IFZS header");return false;}
var chunks=unpack_iff_chunks(quetzal.slice(4));if(!chunks["IFhd"]){qlog("vm_restore failed: missing required IFhd chunk");return false;}
for(var i=0;i<128;i++){if(chunks["IFhd"][i]!=game_image[i]){qlog("vm_restore failed: this save image is for a different game");return false;}}
if(!chunks["CMem"]){qlog("vm_restore failed: missing required CMem chunk");return false;}
if(!chunks["Stks"]){qlog("vm_restore failed: missing required Stks chunk");return false;}
var protect=copy_protected_range();heap_clear();var newendmem=ByteRead4(chunks["CMem"],0);var ram_xor=chunks["CMem"].slice(4);ram_xor=decompress_bytes(ram_xor);while(ram_xor.length<newendmem-ramstart)
ram_xor.push(0);change_memsize(newendmem,false);memmap=null;memmap=new Uint8Array(ramstart+ram_xor.length);memmap.set(game_image.slice(0,ramstart));memmap.set(ram_xor,ramstart);for(var i=ramstart;i<game_image.length;i++){memmap[i]^=game_image[i];}
var stackchunk=chunks["Stks"];stack=[];while(stackchunk.length){self.frame=pop_deserialized_stackframe(stackchunk);if(!self.frame){fatal_error("vm_restore failed: bad stack frame");}
stack.unshift(self.frame);}
for(var i=0;i<stack.length;i++){stack[i].depth=i;}
self.frame=stack[stack.length-1];var heapchunk=chunks["MAll"];if(heapchunk&&heapchunk.length>=8){heapstart=ByteRead4(heapchunk,0);var numblocks=ByteRead4(heapchunk,4);for(var i=0;i<numblocks;i++){var addr=ByteRead4(heapchunk,8+8*i);var size=ByteRead4(heapchunk,12+8*i);usedlist.push(new HeapBlock(addr,size));}
usedlist.sort(function(blk1,blk2){return blk1.addr-blk2.addr;});var heapend=heapstart;for(var i=0;i<usedlist.length;i++){var addr=usedlist[i].addr;var size=usedlist[i].size;if(addr<heapend||(addr+size)>self.endmem){fatal_error("vm_restore failed: corrupt dynamic heap");}
if(addr>heapend){freelist.push(new HeapBlock(heapend,addr-heapend));}
heapend=addr+size;}
if(heapend<self.endmem){freelist.push(new HeapBlock(heapend,self.endmem-heapend));}}
paste_protected_range(protect);return true;}
function vm_autosave(eventaddr){var Dialog=self.Glk.getlibrary('Dialog');if(eventaddr<0){Dialog.autosave_write(game_signature,null);return;}
var opmodes=parse_partial_operand();if(!opmodes)
return;var snapshot={};var valstack=self.frame.valstack;var origstacklen=valstack.length;valstack.push(eventaddr);if(opmodes.argsop==8){valstack.push(1);}
if(opmodes.selop==8){valstack.push(0x00C0);}
valstack.push(0,0,self.prevpc,self.frame.framestart);snapshot.ram=Array.from(memmap.slice(ramstart));snapshot.endmem=self.endmem;snapshot.pc=self.pc;snapshot.stack=[];for(var i=0;i<stack.length;i++){push_serialized_stackframe(stack[i],snapshot.stack);}
if(heap_is_active()){snapshot.heapstart=heapstart;snapshot.usedlist=[];for(var i=0;i<usedlist.length;i++){snapshot.usedlist.push(usedlist[i].addr);snapshot.usedlist.push(usedlist[i].size);}}
valstack.length=origstacklen;snapshot.stringtable=self.stringtable;snapshot.iosysmode=self.iosysmode;snapshot.iosysrock=self.iosysrock;snapshot.protectstart=self.protectstart;snapshot.protectend=self.protectend;if(self.random_func==xo_random_func&&xo_table){snapshot.xo_table=[xo_table[0],xo_table[1],xo_table[2],xo_table[3]];}
snapshot.accel_params=accel_params.slice(0);snapshot.accel_funcnum_map={};for(var ix in accel_funcnum_map)
snapshot.accel_funcnum_map[ix]=accel_funcnum_map[ix];snapshot.glk=self.Glk.save_allstate();Dialog.autosave_write(game_signature,snapshot);}
function vm_autorestore(snapshot){memmap=null;memmap=new Uint8Array(ramstart+snapshot.ram.length);memmap.set(game_image.slice(0,ramstart));memmap.set(snapshot.ram,ramstart);self.endmem=snapshot.endmem;self.pc=snapshot.pc;stack=[];var stackchunk=snapshot.stack.slice(0);while(stackchunk.length){var frm=pop_deserialized_stackframe(stackchunk);if(!frm){fatal_error("vm_autorestore failed: bad stack frame");}
stack.unshift(frm);}
for(var i=0;i<stack.length;i++){stack[i].depth=i;}
self.frame=stack[stack.length-1];if(snapshot.heapstart===undefined){heapstart=0;usedlist=[];freelist=[];}
else{heapstart=snapshot.heapstart;usedlist=[];for(var ix=0;ix<snapshot.usedlist.length;ix+=2){var addr=snapshot.usedlist[ix];var size=snapshot.usedlist[ix+1];usedlist.push(new HeapBlock(addr,size));}
usedlist.sort(function(blk1,blk2){return blk1.addr-blk2.addr;});freelist=[];var heapend=heapstart;for(var i=0;i<usedlist.length;i++){var addr=usedlist[i].addr;var size=usedlist[i].size;if(addr<heapend||(addr+size)>self.endmem){fatal_error("vm_autorestore failed: corrupt dynamic heap");}
if(addr>heapend){freelist.push(new HeapBlock(heapend,addr-heapend));}
heapend=addr+size;}
if(heapend<self.endmem){freelist.push(new HeapBlock(heapend,self.endmem-heapend));}}
set_string_table(snapshot.stringtable);set_iosys(snapshot.iosysmode,snapshot.iosysrock);self.protectstart=snapshot.protectstart;self.protectend=snapshot.protectend;if(snapshot.xo_table===undefined&&snapshot.srand_table!==undefined){snapshot.xo_table=new Uint32Array(snapshot.srand_table.slice(0,4));}
if(snapshot.xo_table===undefined){set_random(0);}
else{set_random(1);xo_table=new Uint32Array(snapshot.xo_table);}
accel_params=snapshot.accel_params.slice(0);for(var ix in snapshot.accel_funcnum_map){accel_funcnum_map[ix]=snapshot.accel_funcnum_map[ix];accel_address_map[ix]=self.accel_func_map[accel_funcnum_map[ix]];}
self.Glk.restore_allstate(snapshot.glk);pop_callstub(0);}
function vm_saveundo(){var snapshot={};snapshot.ram=memmap.slice(ramstart);snapshot.endmem=self.endmem;snapshot.pc=self.pc;snapshot.stack=[];for(var i=0;i<stack.length;i++){snapshot.stack[i]=clone_stackframe(stack[i]);}
snapshot.heapstart=heapstart;snapshot.usedlist=usedlist.slice(0);snapshot.freelist=freelist.slice(0);undostack.push(snapshot);if(undostack.length>10){undostack.shift();}}
function vm_restoreundo(){if(undostack.length==0){return false;}
var snapshot=undostack.pop();var protect=copy_protected_range();var oldrom=memmap.slice(0,ramstart);memmap=null;memmap=new Uint8Array(ramstart+snapshot.ram.length);memmap.set(oldrom);memmap.set(snapshot.ram,ramstart);oldrom=null;self.endmem=snapshot.endmem;stack=snapshot.stack;self.frame=stack[stack.length-1];self.pc=snapshot.pc;heapstart=snapshot.heapstart;usedlist=snapshot.usedlist;freelist=snapshot.freelist;paste_protected_range(protect);return true;}
function vm_hasundo(){if(undostack.length==0){return false;}
return true;}
function vm_discardundo(){if(undostack.length==0){return;}
var snapshot=undostack.pop();}
self.vm_save=vm_save;self.vm_restore=vm_restore;self.vm_saveundo=vm_saveundo;self.vm_restoreundo=vm_restoreundo;self.vm_hasundo=vm_hasundo;self.vm_discardundo=vm_discardundo;function estimate_undo_size(snapshot){var size=snapshot.ram.length;for(var obj of snapshot.stack){size+=4*5;size+=4*obj.valstack.length;size+=4*obj.locals.length;}
size+=12*snapshot.usedlist.length;size+=12*snapshot.freelist.length;return size;}
function change_memsize(newlen,internal){var lx;if(newlen==self.endmem)
return;if((!internal)&&heap_is_active())
fatal_error("Cannot resize Glulx memory space while heap is active.");if(newlen<origendmem)
fatal_error("Cannot resize Glulx memory space smaller than it started.");if(newlen&0xFF)
fatal_error("Can only resize Glulx memory space to a 256-byte boundary.");var oldmem=memmap.slice(0,newlen);memmap=null;memmap=new Uint8Array(newlen);memmap.set(oldmem)
self.endmem=newlen;}
self.change_memsize=change_memsize;function copy_protected_range(){if(self.protectstart>=self.protectend)
return null;var len=self.protectend-self.protectstart;var obj={start:self.protectstart,end:self.protectend,len:len};var arr=Array.from(memmap.slice(self.protectstart,self.protectend));while(arr.length<len)
arr.push(0);obj.mem=arr;return obj;}
function paste_protected_range(obj){if(!obj)
return;var ix,addr;var arr=obj.mem;var start=obj.start;var end=obj.end;if(end>self.endmem)
end=self.endmem;for(ix=0,addr=start;addr<end;ix++,addr++){memmap[addr]=arr[ix];}}
function perform_verify(){var imagelen=game_image.length;var ix,newsum,checksum;if(imagelen<0x100||(imagelen&0xFF)!=0)
return 1;if(imagelen!=ByteRead4(game_image,12))
return 1;checksum=ByteRead4(game_image,32);newsum=(-checksum)>>>0;for(ix=0;ix<imagelen;ix+=4){newsum=(newsum+ByteRead4(game_image,ix))>>>0;}
if(newsum!=checksum)
return 1;return 0;}
self.perform_verify=perform_verify;function quixe_get_signature(){return game_signature;}
function quixe_get_vm_self(){return self;}
function quixe_get_statistics(){var stat={game_image_length:game_image.length,total_execution_time:total_execution_time,total_function_calls:total_function_calls,accel_function_calls:accel_function_calls,total_path_calls:total_path_calls,paths_cached:paths_cached,paths_compiled:paths_compiled,strings_cached:strings_cached,strings_compiled:strings_compiled};return stat;}
function heap_clear(){heapstart=0;usedlist=[];freelist=[];}
function heap_is_active(){return(usedlist.length>0);}
function heap_get_start(){return heapstart;}
function HeapBlock(addr,size){this.addr=addr;this.size=size;this.end=addr+size;}
function heap_binary_search(list,addr){var low=0;var high=list.length;while(low<high){var mid=(low+high)>>1;if(list[mid].addr<addr){low=mid+1;}else{high=mid;}}
return low;}
function heap_malloc(size){if(!heap_is_active()){heapstart=self.endmem;}
for(var i=0,max=freelist.length;i<max;i++){var freeblock=freelist[i];if(freeblock.size>=size){if(freeblock.size>size){freelist[i]=new HeapBlock(freeblock.addr+size,freeblock.size-size);}else{freelist.splice(i,1);}
var pos=heap_binary_search(usedlist,freeblock.addr);usedlist.splice(pos,0,new HeapBlock(freeblock.addr,size));return freeblock.addr;}}
var addr=self.endmem;var rounded_up_size=((size+0xFF)&0xFFFFFF00);change_memsize(self.endmem+rounded_up_size,true);if(rounded_up_size>size){freelist.push(new HeapBlock(addr+size,rounded_up_size-size));}
usedlist.push(new HeapBlock(addr,size));return addr;}
self.heap_malloc=heap_malloc;function heap_free(addr){var pos=heap_binary_search(usedlist,addr);var block=usedlist[pos];if(!block||block.addr!=addr){fatal_error("Tried to free non-existent block");}
usedlist.splice(pos,1);if(usedlist.length==0){change_memsize(heapstart,true);heap_clear();return;}
pos=heap_binary_search(freelist,addr);var next=freelist[pos];if(next&&next.addr==block.end){block=new HeapBlock(addr,block.size+next.size);freelist.splice(pos,1);}
var prev=freelist[pos-1];if(prev&&prev.end==block.addr){block=new HeapBlock(prev.addr,prev.size+block.size);freelist.splice(pos-1,1);pos-=1;}
freelist.splice(pos,0,block);}
self.heap_free=heap_free;function assert_heap_valid(){if(!heap_is_active()){if(heapstart!=0)
fatal_error("Heap inconsistency: heapstart nonzero");if(usedlist.length>0)
fatal_error("Heap inconsistency: usedlist nonempty");if(freelist.length>0)
fatal_error("Heap inconsistency: usedlist nonempty");return;}
if(heapstart==0)
fatal_error("Heap inconsistency: heapstart is zero");var addr=heapstart;var upos=0,fpos=0;while(upos<usedlist.length||fpos<freelist.length){var u=usedlist[upos];var f=freelist[fpos];if(u&&u.addr==addr){addr+=u.size;upos++;}else if(f&&f.addr==addr){addr+=f.size;fpos++;}else{fatal_error("Heap inconsistency: no block at address "+addr);}}
if(addr!=self.endmem)
fatal_error("Heap inconsistency: overrun at end of heap");}
self.assert_heap_valid=assert_heap_valid;var debuginfo={map:{},functions:[],functionmap:{}};function quixe_get_debuginfo(){return debuginfo;}
function parse_inform_debug_data(){if(!self.GiLoad)
return;var buf=self.GiLoad.get_debug_info();if(!buf)
return;var done;var pos,oldpos;if(!(buf[0]==0xDE&&buf[1]==0xBF&&buf[2]==0&&buf[3]==0)){qlog("Dbug chunk did not contain an (old-style) Inform gameinfo.dbg file");return;}
var informversion=(buf[4]<<8)|(buf[5]);pos=6;done=false;while(!done){var rectype=buf[pos++];switch(rectype){case 0:case undefined:done=true;break;case 1:var filenum=buf[pos++];oldpos=pos;while(buf[pos]){pos++};var includename=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;oldpos=pos;while(buf[pos]){pos++};var filename=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 2:oldpos=pos;while(buf[pos]){pos++};var classname=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;var linestart=buf.slice(pos,pos+4);pos+=4;var lineend=buf.slice(pos,pos+4);pos+=4;break;case 3:var objnum=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var objname=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;var linestart=buf.slice(pos,pos+4);pos+=4;var lineend=buf.slice(pos,pos+4);pos+=4;break;case 4:var num=(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 5:var num=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 6:var num=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 7:var num=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 8:var num=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 9:pos+=64;break;case 10:var funcnum=(buf[pos++]<<8)|(buf[pos++]);var seqcount=(buf[pos++]<<8)|(buf[pos++]);pos+=seqcount*6;break;case 11:var funcnum=(buf[pos++]<<8)|(buf[pos++]);var line=buf.slice(pos,pos+4);pos+=4;var funcaddr=(buf[pos++]<<16)|(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var funcname=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;var locals=[];while(buf[pos]){oldpos=pos;while(buf[pos]){pos++};var locname=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;locals.push(locname);}
pos++;debuginfo.functions.push({num:funcnum,name:funcname,addr:funcaddr,locals:locals});break;case 12:var arrayaddr=(buf[pos++]<<8)|(buf[pos++]);oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;break;case 13:while(buf[pos]){oldpos=pos;while(buf[pos]){pos++};var name=String.fromCharCode.apply(this,buf.slice(oldpos,pos));pos++;var addr=(buf[pos++]<<16)|(buf[pos++]<<8)|(buf[pos++]);debuginfo.map[name]=addr;}
pos++;break;case 14:var funcnum=(buf[pos++]<<8)|(buf[pos++]);var line=buf.slice(pos,pos+4);pos+=4;var endaddr=(buf[pos++]<<16)|(buf[pos++]<<8)|(buf[pos++]);break;default:qlog("Unknown record type in debug data: "+rectype);done=true;break;}}
var funcbase=debuginfo.map["code area"];if(funcbase){var ix;for(ix=0;ix<debuginfo.functions.length;ix++){var func=debuginfo.functions[ix];debuginfo.functionmap[funcbase+func.addr]=func;}}}
self.VMStopped={dummy:'The top-level function has returned.'};function execute_loop(){var vmfunc,pathtab,path;var pathstart,pathend;if(self.resumefuncop){store_operand_by_funcop(self.resumefuncop,self.resumevalue);self.resumefuncop=null;self.resumevalue=0;}
pathstart=new Date().getTime();while(!self.done_executing){vmfunc=self.frame.vmfunc;pathtab=vmfunc[self.iosysmode];path=pathtab[self.pc];if(path===undefined){vmfunc.pathaddrs[self.pc]=true;path=compile_path(vmfunc,self.pc,self.iosysmode);paths_compiled++;if(self.pc<ramstart){pathtab[self.pc]=path;paths_cached++;}}
total_path_calls++;var res=path(self);if(res===self.VMStopped){self.done_executing=true;self.vm_stopped=true;}}
pathend=new Date().getTime();total_execution_time+=(pathend-pathstart)/1000.0;if(self.vm_stopped){self.Glk.glk_exit();}
self.Glk.update();if(opt_log_execution_time){qlog("event executed in "+(pathend-pathstart)+" ms");}}
return{classname:'Quixe',version:'2.2.6',init:quixe_init,inited:quixe_inited,getlibrary:quixe_getlibrary,start:quixe_start,resume:quixe_resume,get_signature:quixe_get_signature,get_vm_internals:quixe_get_vm_self,get_statistics:quixe_get_statistics,get_debuginfo:quixe_get_debuginfo,ReadByte:ReadArgByte,WriteByte:WriteArgByte,ReadWord:ReadArgWord,WriteWord:WriteArgWord,ReadStructField:ReadStructField,WriteStructField:WriteStructField,SetResumeStore:SetResumeStore,do_autosave:vm_autosave};};var Quixe=new QuixeClass();try{exports.Quixe=Quixe;exports.QuixeClass=QuixeClass;}catch(ex){};'use strict';var GiDispaClass=function(){var self={};self.VM=null;self.Glk=null;function gidispa_init(options){self.VM=options.vm;self.Glk=options.io;}
function gidispa_inited(){return(self.VM!=null);}
function gidispa_getlibrary(val){switch(val){case'VM':return self.VM;case'Glk':return self.Glk;}
return null;}
var class_defs={0:'window',1:'stream',2:'fileref',3:'schannel'};function FuncSpec(id,name,proto){this.id=id;this.name=name;this.proto=proto;}
function Prototype(args,retarg){this.args=args;this.retarg=retarg;}
function ArgString(){this.macro='Byte';this.refsize=1;this.serialize=function(){return{type:'ArgString'};};}
function ArgUnicode(){this.macro='Word';this.refsize=4;this.serialize=function(){return{type:'ArgUnicode'};};}
function ArgChar(signed){this.signed=signed;this.macro='Byte';this.refsize=1;this.literal=(signed?'arg_char_signed':'arg_char_unsigned');this.serialize=function(){return{type:'ArgChar',signed:signed};};}
function ArgInt(signed){this.signed=signed;this.macro='Word';this.refsize=4;this.literal=(signed?'arg_int_signed':'arg_int_unsigned');this.serialize=function(){return{type:'ArgInt',signed:signed};};}
function ArgClass(name){this.name=name;this.macro='Word';this.refsize=4;}
function ArgStruct(form){this.form=form;}
function ArgRef(arg,passin,passout,nonnull){this.arg=arg;this.passin=passin;this.passout=passout;this.nonnull=nonnull;}
function ArgArray(arg,retained,passin,passout,nonnull){this.arg=arg;this.retained=retained;this.passin=passin;this.passout=passout;this.nonnull=nonnull;}
function arg_deserialize(obj){switch(obj.type){case'ArgString':return new ArgString();case'ArgUnicode':return new ArgUnicode();case'ArgInt':if(obj.signed)
return arg_int_signed;else
return arg_int_unsigned;case'ArgChar':if(obj.signed===null)
return arg_char_native;else if(obj.signed)
return arg_char_signed;else
return arg_char_unsigned;}
throw new Error('arg_deserialize: unknown type: '+obj.type);}
var arg_int_unsigned=new ArgInt(false);var arg_int_signed=new ArgInt(true);var arg_char_unsigned=new ArgChar(false);var arg_char_native=new ArgChar(null);var arg_char_signed=new ArgChar(true);var arg_class_window=new ArgClass("window");var arg_class_stream=new ArgClass("stream");var arg_class_fileref=new ArgClass("fileref");var arg_class_schannel=new ArgClass("schannel");var proto_map={1:new FuncSpec(1,"exit",new Prototype([],null)),3:new FuncSpec(3,"tick",new Prototype([],null)),4:new FuncSpec(4,"gestalt",new Prototype([arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),5:new FuncSpec(5,"gestalt_ext",new Prototype([arg_int_unsigned,arg_int_unsigned,new ArgArray(arg_int_unsigned,false,true,true,false)],new ArgRef(arg_int_unsigned,false,true,true))),32:new FuncSpec(32,"window_iterate",new Prototype([arg_class_window,new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_class_window,false,true,true))),33:new FuncSpec(33,"window_get_rock",new Prototype([arg_class_window],new ArgRef(arg_int_unsigned,false,true,true))),34:new FuncSpec(34,"window_get_root",new Prototype([],new ArgRef(arg_class_window,false,true,true))),35:new FuncSpec(35,"window_open",new Prototype([arg_class_window,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_window,false,true,true))),36:new FuncSpec(36,"window_close",new Prototype([arg_class_window,new ArgRef(new ArgStruct(new Prototype([arg_int_unsigned,arg_int_unsigned],null)),false,true,false)],null)),37:new FuncSpec(37,"window_get_size",new Prototype([arg_class_window,new ArgRef(arg_int_unsigned,false,true,false),new ArgRef(arg_int_unsigned,false,true,false)],null)),38:new FuncSpec(38,"window_set_arrangement",new Prototype([arg_class_window,arg_int_unsigned,arg_int_unsigned,arg_class_window],null)),39:new FuncSpec(39,"window_get_arrangement",new Prototype([arg_class_window,new ArgRef(arg_int_unsigned,false,true,false),new ArgRef(arg_int_unsigned,false,true,false),new ArgRef(arg_class_window,false,true,false)],null)),40:new FuncSpec(40,"window_get_type",new Prototype([arg_class_window],new ArgRef(arg_int_unsigned,false,true,true))),41:new FuncSpec(41,"window_get_parent",new Prototype([arg_class_window],new ArgRef(arg_class_window,false,true,true))),42:new FuncSpec(42,"window_clear",new Prototype([arg_class_window],null)),43:new FuncSpec(43,"window_move_cursor",new Prototype([arg_class_window,arg_int_unsigned,arg_int_unsigned],null)),44:new FuncSpec(44,"window_get_stream",new Prototype([arg_class_window],new ArgRef(arg_class_stream,false,true,true))),45:new FuncSpec(45,"window_set_echo_stream",new Prototype([arg_class_window,arg_class_stream],null)),46:new FuncSpec(46,"window_get_echo_stream",new Prototype([arg_class_window],new ArgRef(arg_class_stream,false,true,true))),47:new FuncSpec(47,"set_window",new Prototype([arg_class_window],null)),48:new FuncSpec(48,"window_get_sibling",new Prototype([arg_class_window],new ArgRef(arg_class_window,false,true,true))),64:new FuncSpec(64,"stream_iterate",new Prototype([arg_class_stream,new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_class_stream,false,true,true))),65:new FuncSpec(65,"stream_get_rock",new Prototype([arg_class_stream],new ArgRef(arg_int_unsigned,false,true,true))),66:new FuncSpec(66,"stream_open_file",new Prototype([arg_class_fileref,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),67:new FuncSpec(67,"stream_open_memory",new Prototype([new ArgArray(arg_char_native,true,true,true,false),arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),68:new FuncSpec(68,"stream_close",new Prototype([arg_class_stream,new ArgRef(new ArgStruct(new Prototype([arg_int_unsigned,arg_int_unsigned],null)),false,true,false)],null)),69:new FuncSpec(69,"stream_set_position",new Prototype([arg_class_stream,arg_int_signed,arg_int_unsigned],null)),70:new FuncSpec(70,"stream_get_position",new Prototype([arg_class_stream],new ArgRef(arg_int_unsigned,false,true,true))),71:new FuncSpec(71,"stream_set_current",new Prototype([arg_class_stream],null)),72:new FuncSpec(72,"stream_get_current",new Prototype([],new ArgRef(arg_class_stream,false,true,true))),73:new FuncSpec(73,"stream_open_resource",new Prototype([arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),96:new FuncSpec(96,"fileref_create_temp",new Prototype([arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_fileref,false,true,true))),97:new FuncSpec(97,"fileref_create_by_name",new Prototype([arg_int_unsigned,new ArgString(),arg_int_unsigned],new ArgRef(arg_class_fileref,false,true,true))),98:new FuncSpec(98,"fileref_create_by_prompt",new Prototype([arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_fileref,false,true,true))),99:new FuncSpec(99,"fileref_destroy",new Prototype([arg_class_fileref],null)),100:new FuncSpec(100,"fileref_iterate",new Prototype([arg_class_fileref,new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_class_fileref,false,true,true))),101:new FuncSpec(101,"fileref_get_rock",new Prototype([arg_class_fileref],new ArgRef(arg_int_unsigned,false,true,true))),102:new FuncSpec(102,"fileref_delete_file",new Prototype([arg_class_fileref],null)),103:new FuncSpec(103,"fileref_does_file_exist",new Prototype([arg_class_fileref],new ArgRef(arg_int_unsigned,false,true,true))),104:new FuncSpec(104,"fileref_create_from_fileref",new Prototype([arg_int_unsigned,arg_class_fileref,arg_int_unsigned],new ArgRef(arg_class_fileref,false,true,true))),128:new FuncSpec(128,"put_char",new Prototype([arg_char_unsigned],null)),129:new FuncSpec(129,"put_char_stream",new Prototype([arg_class_stream,arg_char_unsigned],null)),130:new FuncSpec(130,"put_string",new Prototype([new ArgString()],null)),131:new FuncSpec(131,"put_string_stream",new Prototype([arg_class_stream,new ArgString()],null)),132:new FuncSpec(132,"put_buffer",new Prototype([new ArgArray(arg_char_native,false,true,false,true)],null)),133:new FuncSpec(133,"put_buffer_stream",new Prototype([arg_class_stream,new ArgArray(arg_char_native,false,true,false,true)],null)),134:new FuncSpec(134,"set_style",new Prototype([arg_int_unsigned],null)),135:new FuncSpec(135,"set_style_stream",new Prototype([arg_class_stream,arg_int_unsigned],null)),144:new FuncSpec(144,"get_char_stream",new Prototype([arg_class_stream],new ArgRef(arg_int_signed,false,true,true))),145:new FuncSpec(145,"get_line_stream",new Prototype([arg_class_stream,new ArgArray(arg_char_native,false,false,true,true)],new ArgRef(arg_int_unsigned,false,true,true))),146:new FuncSpec(146,"get_buffer_stream",new Prototype([arg_class_stream,new ArgArray(arg_char_native,false,false,true,true)],new ArgRef(arg_int_unsigned,false,true,true))),160:new FuncSpec(160,"char_to_lower",new Prototype([arg_char_unsigned],new ArgRef(arg_char_unsigned,false,true,true))),161:new FuncSpec(161,"char_to_upper",new Prototype([arg_char_unsigned],new ArgRef(arg_char_unsigned,false,true,true))),176:new FuncSpec(176,"stylehint_set",new Prototype([arg_int_unsigned,arg_int_unsigned,arg_int_unsigned,arg_int_signed],null)),177:new FuncSpec(177,"stylehint_clear",new Prototype([arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],null)),178:new FuncSpec(178,"style_distinguish",new Prototype([arg_class_window,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),179:new FuncSpec(179,"style_measure",new Prototype([arg_class_window,arg_int_unsigned,arg_int_unsigned,new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_int_unsigned,false,true,true))),192:new FuncSpec(192,"select",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_unsigned,arg_class_window,arg_int_unsigned,arg_int_unsigned],null)),false,true,true)],null)),193:new FuncSpec(193,"select_poll",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_unsigned,arg_class_window,arg_int_unsigned,arg_int_unsigned],null)),false,true,true)],null)),208:new FuncSpec(208,"request_line_event",new Prototype([arg_class_window,new ArgArray(arg_char_native,true,true,true,true),arg_int_unsigned],null)),209:new FuncSpec(209,"cancel_line_event",new Prototype([arg_class_window,new ArgRef(new ArgStruct(new Prototype([arg_int_unsigned,arg_class_window,arg_int_unsigned,arg_int_unsigned],null)),false,true,false)],null)),210:new FuncSpec(210,"request_char_event",new Prototype([arg_class_window],null)),211:new FuncSpec(211,"cancel_char_event",new Prototype([arg_class_window],null)),212:new FuncSpec(212,"request_mouse_event",new Prototype([arg_class_window],null)),213:new FuncSpec(213,"cancel_mouse_event",new Prototype([arg_class_window],null)),214:new FuncSpec(214,"request_timer_events",new Prototype([arg_int_unsigned],null)),224:new FuncSpec(224,"image_get_info",new Prototype([arg_int_unsigned,new ArgRef(arg_int_unsigned,false,true,false),new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_int_unsigned,false,true,true))),225:new FuncSpec(225,"image_draw",new Prototype([arg_class_window,arg_int_unsigned,arg_int_signed,arg_int_signed],new ArgRef(arg_int_unsigned,false,true,true))),226:new FuncSpec(226,"image_draw_scaled",new Prototype([arg_class_window,arg_int_unsigned,arg_int_signed,arg_int_signed,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),232:new FuncSpec(232,"window_flow_break",new Prototype([arg_class_window],null)),233:new FuncSpec(233,"window_erase_rect",new Prototype([arg_class_window,arg_int_signed,arg_int_signed,arg_int_unsigned,arg_int_unsigned],null)),234:new FuncSpec(234,"window_fill_rect",new Prototype([arg_class_window,arg_int_unsigned,arg_int_signed,arg_int_signed,arg_int_unsigned,arg_int_unsigned],null)),235:new FuncSpec(235,"window_set_background_color",new Prototype([arg_class_window,arg_int_unsigned],null)),236:new FuncSpec(236,"image_draw_scaled_ext",new Prototype([arg_class_window,arg_int_unsigned,arg_int_signed,arg_int_signed,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),240:new FuncSpec(240,"schannel_iterate",new Prototype([arg_class_schannel,new ArgRef(arg_int_unsigned,false,true,false)],new ArgRef(arg_class_schannel,false,true,true))),241:new FuncSpec(241,"schannel_get_rock",new Prototype([arg_class_schannel],new ArgRef(arg_int_unsigned,false,true,true))),242:new FuncSpec(242,"schannel_create",new Prototype([arg_int_unsigned],new ArgRef(arg_class_schannel,false,true,true))),243:new FuncSpec(243,"schannel_destroy",new Prototype([arg_class_schannel],null)),244:new FuncSpec(244,"schannel_create_ext",new Prototype([arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_schannel,false,true,true))),247:new FuncSpec(247,"schannel_play_multi",new Prototype([new ArgArray(arg_class_schannel,false,true,false,true),new ArgArray(arg_int_unsigned,false,true,false,true),arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),248:new FuncSpec(248,"schannel_play",new Prototype([arg_class_schannel,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),249:new FuncSpec(249,"schannel_play_ext",new Prototype([arg_class_schannel,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),250:new FuncSpec(250,"schannel_stop",new Prototype([arg_class_schannel],null)),251:new FuncSpec(251,"schannel_set_volume",new Prototype([arg_class_schannel,arg_int_unsigned],null)),252:new FuncSpec(252,"sound_load_hint",new Prototype([arg_int_unsigned,arg_int_unsigned],null)),253:new FuncSpec(253,"schannel_set_volume_ext",new Prototype([arg_class_schannel,arg_int_unsigned,arg_int_unsigned,arg_int_unsigned],null)),254:new FuncSpec(254,"schannel_pause",new Prototype([arg_class_schannel],null)),255:new FuncSpec(255,"schannel_unpause",new Prototype([arg_class_schannel],null)),256:new FuncSpec(256,"set_hyperlink",new Prototype([arg_int_unsigned],null)),257:new FuncSpec(257,"set_hyperlink_stream",new Prototype([arg_class_stream,arg_int_unsigned],null)),258:new FuncSpec(258,"request_hyperlink_event",new Prototype([arg_class_window],null)),259:new FuncSpec(259,"cancel_hyperlink_event",new Prototype([arg_class_window],null)),288:new FuncSpec(288,"buffer_to_lower_case_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,true,true),arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),289:new FuncSpec(289,"buffer_to_upper_case_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,true,true),arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),290:new FuncSpec(290,"buffer_to_title_case_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,true,true),arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),291:new FuncSpec(291,"buffer_canon_decompose_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,true,true),arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),292:new FuncSpec(292,"buffer_canon_normalize_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,true,true),arg_int_unsigned],new ArgRef(arg_int_unsigned,false,true,true))),296:new FuncSpec(296,"put_char_uni",new Prototype([arg_int_unsigned],null)),297:new FuncSpec(297,"put_string_uni",new Prototype([new ArgUnicode()],null)),298:new FuncSpec(298,"put_buffer_uni",new Prototype([new ArgArray(arg_int_unsigned,false,true,false,true)],null)),299:new FuncSpec(299,"put_char_stream_uni",new Prototype([arg_class_stream,arg_int_unsigned],null)),300:new FuncSpec(300,"put_string_stream_uni",new Prototype([arg_class_stream,new ArgUnicode()],null)),301:new FuncSpec(301,"put_buffer_stream_uni",new Prototype([arg_class_stream,new ArgArray(arg_int_unsigned,false,true,false,true)],null)),304:new FuncSpec(304,"get_char_stream_uni",new Prototype([arg_class_stream],new ArgRef(arg_int_signed,false,true,true))),305:new FuncSpec(305,"get_buffer_stream_uni",new Prototype([arg_class_stream,new ArgArray(arg_int_unsigned,false,false,true,true)],new ArgRef(arg_int_unsigned,false,true,true))),306:new FuncSpec(306,"get_line_stream_uni",new Prototype([arg_class_stream,new ArgArray(arg_int_unsigned,false,false,true,true)],new ArgRef(arg_int_unsigned,false,true,true))),312:new FuncSpec(312,"stream_open_file_uni",new Prototype([arg_class_fileref,arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),313:new FuncSpec(313,"stream_open_memory_uni",new Prototype([new ArgArray(arg_int_unsigned,true,true,true,false),arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),314:new FuncSpec(314,"stream_open_resource_uni",new Prototype([arg_int_unsigned,arg_int_unsigned],new ArgRef(arg_class_stream,false,true,true))),320:new FuncSpec(320,"request_char_event_uni",new Prototype([arg_class_window],null)),321:new FuncSpec(321,"request_line_event_uni",new Prototype([arg_class_window,new ArgArray(arg_int_unsigned,true,true,true,true),arg_int_unsigned],null)),336:new FuncSpec(336,"set_echo_line_event",new Prototype([arg_class_window,arg_int_unsigned],null)),337:new FuncSpec(337,"set_terminators_line_event",new Prototype([arg_class_window,new ArgArray(arg_int_unsigned,false,true,false,false)],null)),352:new FuncSpec(352,"current_time",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_unsigned,arg_int_signed],null)),false,true,true)],null)),353:new FuncSpec(353,"current_simple_time",new Prototype([arg_int_unsigned],new ArgRef(arg_int_signed,false,true,true))),360:new FuncSpec(360,"time_to_date_utc",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_unsigned,arg_int_signed],null)),true,false,true),new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),false,true,true)],null)),361:new FuncSpec(361,"time_to_date_local",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_unsigned,arg_int_signed],null)),true,false,true),new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),false,true,true)],null)),362:new FuncSpec(362,"simple_time_to_date_utc",new Prototype([arg_int_signed,arg_int_unsigned,new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),false,true,true)],null)),363:new FuncSpec(363,"simple_time_to_date_local",new Prototype([arg_int_signed,arg_int_unsigned,new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),false,true,true)],null)),364:new FuncSpec(364,"date_to_time_utc",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),true,false,true),new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_unsigned,arg_int_signed],null)),false,true,true)],null)),365:new FuncSpec(365,"date_to_time_local",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),true,false,true),new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_unsigned,arg_int_signed],null)),false,true,true)],null)),366:new FuncSpec(366,"date_to_simple_time_utc",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),true,false,true),arg_int_unsigned],new ArgRef(arg_int_signed,false,true,true))),367:new FuncSpec(367,"date_to_simple_time_local",new Prototype([new ArgRef(new ArgStruct(new Prototype([arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed,arg_int_signed],null)),true,false,true),arg_int_unsigned],new ArgRef(arg_int_signed,false,true,true)))};self.arg_int_unsigned=arg_int_unsigned;self.arg_int_signed=arg_int_signed;self.arg_char_unsigned=arg_char_unsigned;self.arg_char_native=arg_char_native;self.arg_char_signed=arg_char_signed;function convert_arg(arg,passin,val){if(arg instanceof ArgInt){if(passin){if(!arg.signed)
return val;else
return val+' & 0xFFFFFFFF';}
else{return'0';}}
if(arg instanceof ArgChar){if(passin){if(!arg.signed)
return val+' & 0xFF';else
return'self.cast_signed_char('+val+')'}
else{return'0';}}
if(arg instanceof ArgClass){if(passin){return'self.class_obj_from_id("'+arg.name+'", '+val+')';}
else{return'null';}}
return'???';}
function unconvert_arg(arg,val){if(arg instanceof ArgInt){return val+' >>> 0';}
if(arg instanceof ArgChar){if(!arg.signed)
return val+' & 0xFF';else
return'self.uncast_signed_char('+val+')'}
if(arg instanceof ArgClass){return'self.class_obj_to_id("'+arg.name+'", '+val+')';}
return'???';}
function cast_signed_char(val){val=val&0xFF;if(val&0x80)
val-=0x100;return val;}
self.cast_signed_char=cast_signed_char;function uncast_signed_char(val){val=val&0xFF;if(val&0x80)
val+=0xFFFFFF00;return val;}
self.uncast_signed_char=uncast_signed_char;function class_obj_to_id(clas,val){if(!val)
return 0;return val.disprock;}
self.class_obj_to_id=class_obj_to_id;function class_obj_from_id(clas,val){if(val==0||!val)
return null;return class_map[clas][val];}
self.class_obj_from_id=class_obj_from_id;function build_function(func){var ix,jx;var form,retarg,argpos,argjoin,subargs;var arg,refarg,tmpvar,val,retval,ls;var mayblock;var out=[];var locals={};var arraycount=0;out.push('// no local vars');out.push('// '+func.id+': '+func.name);form=func.proto;retarg=null;if(form.retarg)
retarg=form.retarg.arg;out.push('var self = this;');mayblock=self.Glk.call_may_not_return(func.id);argpos=0;argjoin=[];for(ix=0;ix<form.args.length;ix++){arg=form.args[ix];tmpvar='glka'+ix;argjoin.push(tmpvar);locals[tmpvar]=true;if((arg instanceof ArgInt)||(arg instanceof ArgChar)||(arg instanceof ArgClass)){val=convert_arg(arg,true,'callargs['+argpos+']');out.push(tmpvar+' = '+val+';');argpos+=1;}
else if(arg instanceof ArgRef){refarg=arg.arg;out.push('if (callargs['+argpos+'] == 0) {');if(arg.nonnull)
out.push('  throw new Error("glk '+func.name+': null argument");');else
out.push('  '+tmpvar+' = null;');out.push('} else {');if((refarg instanceof ArgInt)||(refarg instanceof ArgChar)||(refarg instanceof ArgClass)){out.push('  '+tmpvar+' = new self.Glk.RefBox();');val=convert_arg(refarg,arg.passin,'self.VM.ReadWord(callargs['+argpos+'])');out.push('  '+tmpvar+'.set_value('+val+');');}
else if(refarg instanceof ArgStruct){subargs=refarg.form.args;out.push('  '+tmpvar+' = new self.Glk.RefStruct('+subargs.length+');');for(jx=0;jx<subargs.length;jx++){val=convert_arg(subargs[jx],arg.passin,'self.VM.ReadStructField(callargs['+argpos+'], '+jx+')');out.push('  '+tmpvar+'.push_field('+val+');');}}
else{throw new Error('buildfunc: unsupported refarg type: '+func.name);}
out.push('}');argpos+=1;}
else if(arg instanceof ArgArray){locals['glklen']=true;refarg=arg.arg;out.push('if (callargs['+argpos+'] == 0) {');if(arg.nonnull)
out.push('  throw new Error("glk '+func.name+': null argument");');else
out.push('  '+tmpvar+' = null;');out.push('} else {');out.push('  glklen = callargs['+(argpos+1)+'];');out.push('  '+tmpvar+' = Array(glklen);');if(arg.passin){locals['ix']=true;locals['jx']=true;out.push('  for (ix=0, jx=callargs['+argpos+']; ix<glklen; ix++, jx+='+refarg.refsize+') {');val=convert_arg(refarg,true,'self.VM.Read'+refarg.macro+'(jx)');out.push('    '+tmpvar+'[ix] = '+val+';');out.push('  }');}
if(arg.retained){if(arraycount==0)
out.push('  self.temp_arg_arrays.length = 0;');arraycount+=1;out.push('  self.make_arg_array('+tmpvar+', callargs['+argpos+'], glklen, self.'+refarg.literal+');');}
out.push('}');argpos+=2;}
else if((arg instanceof ArgString)||(arg instanceof ArgUnicode)){locals['ix']=true;locals['jx']=true;var confunc,checkbyte;if(arg instanceof ArgString){checkbyte='0xE0';confunc='byte_array_to_string';}
else{checkbyte='0xE2';confunc='uni_array_to_string';}
out.push(tmpvar+' = Array();');out.push('jx = callargs['+argpos+'];');out.push('if (self.VM.ReadByte(jx) != '+checkbyte+') throw new Error("glk '+func.name+': string argument must be unencoded");');out.push('for (jx+='+arg.refsize+'; true; jx+='+arg.refsize+') {');out.push('  ix = self.VM.Read'+arg.macro+'(jx);');out.push('  if (ix == 0) break;');out.push('  '+tmpvar+'.push(ix);');out.push('}');out.push(tmpvar+' = self.Glk.'+confunc+'('+tmpvar+');');argpos+=1;}
else{throw new Error('buildfunc: unsupported arg type: '+func.name);}}
out.push('if (callargs.length != '+argpos+') throw "glk '+func.name+': wrong number of arguments";');if(retarg||mayblock){locals['glkret']=true;retval='glkret = ';}
else{retval='';}
out.push(retval+'self.Glk.glk_'+func.name+'('+argjoin.join(', ')+');');if(mayblock){out.push('if (glkret === self.Glk.DidNotReturn) {');out.push('  self.set_blocked_selector('+func.id+', callargs);');out.push('  return glkret;');out.push('}');}
argpos=0;for(ix=0;ix<form.args.length;ix++){arg=form.args[ix];tmpvar='glka'+ix;if((arg instanceof ArgInt)||(arg instanceof ArgChar)||(arg instanceof ArgClass)){argpos+=1;}
else if(arg instanceof ArgRef){refarg=arg.arg;if(arg.passout){out.push('if ('+tmpvar+') {');if((refarg instanceof ArgInt)||(refarg instanceof ArgChar)||(refarg instanceof ArgClass)){val=unconvert_arg(refarg,tmpvar+'.get_value()');out.push('  self.VM.WriteWord(callargs['+argpos+'], '+val+');');}
else if(refarg instanceof ArgStruct){subargs=refarg.form.args;for(jx=0;jx<subargs.length;jx++){val=unconvert_arg(subargs[jx],tmpvar+'.get_field('+jx+')');out.push('  self.VM.WriteStructField(callargs['+argpos+'], '+jx+', '+val+');');}}
else{throw new Error('buildfunc: unsupported refarg type: '+func.name);}
out.push('}');}
argpos+=1;}
else if(arg instanceof ArgArray){refarg=arg.arg;if(arg.passout&&!arg.retained){out.push('if ('+tmpvar+') {');locals['ix']=true;locals['jx']=true;out.push('  for (ix=0, jx=callargs['+argpos+']; ix<glklen; ix++, jx+='+refarg.refsize+') {');val=unconvert_arg(refarg,tmpvar+'[ix]');out.push('    self.VM.Write'+refarg.macro+'(jx, '+val+')');out.push('  }');out.push('}');}
argpos+=2;}
else if((arg instanceof ArgString)||(arg instanceof ArgUnicode)){argpos+=1;}
else{throw new Error('buildfunc: unsupported arg type: '+func.name);}}
if(arraycount!=0)
out.push('self.temp_arg_arrays.length = 0;');if(retarg){val=unconvert_arg(retarg,'glkret');out.push('return '+val+';');}
else{out.push('return 0;');}
ls=[];for(val in locals)
ls.push(val);if(ls.length)
out[0]='var '+ls.join(', ')+';';val=out.join('\n');var resfunc=new Function('callargs',val);return resfunc.bind(self);}
var function_map={};function get_function(id){var proto;var func=function_map[id];if(func===undefined){proto=proto_map[id];if(proto===undefined)
throw new Error('dispatch: unknown Glk function: '+id);func=build_function(proto);function_map[id]=func;}
return func;}
var blocked_selector=null;var blocked_callargs=null;var last_event_type=-1;function set_blocked_selector(sel,args){blocked_selector=sel;blocked_callargs=args.slice(0);}
self.set_blocked_selector=set_blocked_selector;function check_autosave(){if(blocked_selector==0x0C0&&blocked_callargs&&blocked_callargs.length>0){if(last_event_type==2||last_event_type==3||last_event_type==4||last_event_type==8){return blocked_callargs[0];}}
return null;}
function prepare_resume(glka0){if(blocked_selector==0x0C0){if(blocked_callargs[0]!=0){last_event_type=(glka0.get_field(0)>>>0);self.VM.WriteStructField(blocked_callargs[0],0,glka0.get_field(0)>>>0);self.VM.WriteStructField(blocked_callargs[0],1,class_obj_to_id("window",glka0.get_field(1)));self.VM.WriteStructField(blocked_callargs[0],2,glka0.get_field(2)>>>0);self.VM.WriteStructField(blocked_callargs[0],3,glka0.get_field(3)>>>0);}}
else if(blocked_selector==0x062){self.VM.SetResumeStore(class_obj_to_id("fileref",glka0));}
blocked_selector=null;blocked_callargs=null;}
var temp_arg_arrays=[];self.temp_arg_arrays=temp_arg_arrays;var retained_arrays=[];self.retained_arrays=retained_arrays;function make_arg_array(arr,addr,len,arg){var obj;if(!arr)
return;obj={arr:arr,addr:addr,len:len,arg:arg};temp_arg_arrays.push(obj);}
self.make_arg_array=make_arg_array;function retain_array(arr,useobj){var ix,obj;if(!arr)
return;if(useobj!==undefined){if(arr!==useobj.arr)
throw new Error('retain_array: array does not match useobj');obj={addr:useobj.addr,len:useobj.len,arr:arr,arg:arg_deserialize(useobj.arg)}
if(obj.len!=arr.length)
throw new Error('retain_array: array length from useobj does not match');}
else{obj=undefined;for(ix=0;ix<temp_arg_arrays.length;ix++){if(temp_arg_arrays[ix].arr===arr){obj=temp_arg_arrays[ix];break;}}}
if(obj===undefined)
throw new Error('retain_array: array is not an argument');for(ix=0;!(retained_arrays[ix]===undefined);ix++){};retained_arrays[ix]=obj;}
function get_retained_array(arr){var ix;for(ix=0;ix<retained_arrays.length;ix++){if(retained_arrays[ix]===undefined)
continue;if(retained_arrays[ix].arr===arr){return retained_arrays[ix];}}
return null;}
function unretain_array(arr){var ix,jx,obj;if(!arr)
return;obj=undefined;for(ix=0;ix<retained_arrays.length;ix++){if(retained_arrays[ix]===undefined)
continue;if(retained_arrays[ix].arr===arr){obj=retained_arrays[ix];delete retained_arrays[ix];break;}}
if(obj===undefined)
throw new Error('unretain_array: array was never retained');if(obj.arg instanceof ArgInt){for(ix=0,jx=obj.addr;ix<obj.len;ix++,jx+=4){self.VM.WriteWord(jx,obj.arr[ix]>>>0);}}
else if(obj.arg instanceof ArgChar){if(!obj.arg.signed){for(ix=0,jx=obj.addr;ix<obj.len;ix++,jx++){self.VM.WriteByte(jx,obj.arr[ix]&0xFF);}}
else{for(ix=0,jx=obj.addr;ix<obj.len;ix++,jx++){self.VM.WriteByte(jx,uncast_signed_char(obj.arr[ix]));}}}
else{throw new Error('unretain_array: unsupported refarg type');}}
var class_map={};var last_used_id;function class_register(clas,obj,usedisprock){if(usedisprock===undefined){if(obj.disprock)
throw new Error('class_register: object is already registered');obj.disprock=last_used_id;last_used_id++;}
else{if(obj.disprock!=usedisprock)
throw new Error('class_register: object is not already registered');if(last_used_id<=usedisprock)
last_used_id=usedisprock+1;}
class_map[clas][obj.disprock]=obj;}
function class_unregister(clas,obj){if(!obj.disprock||class_map[clas][obj.disprock]===undefined)
throw new Error('class_unregister: object is not registered');delete class_map[clas][obj.disprock];obj.disprock=undefined;}
function init_module(){var ix,key;last_used_id=1+Math.round(Math.random()*1000);for(ix in class_defs){key=class_defs[ix];class_map[key]={};}};init_module();return{classname:'GiDispa',init:gidispa_init,inited:gidispa_inited,getlibrary:gidispa_getlibrary,get_function:get_function,prepare_resume:prepare_resume,check_autosave:check_autosave,class_register:class_register,class_unregister:class_unregister,class_obj_to_id:class_obj_to_id,class_obj_from_id:class_obj_from_id,retain_array:retain_array,unretain_array:unretain_array,get_retained_array:get_retained_array};};try{exports.GiDispaClass=GiDispaClass;}catch(ex){};'use strict';var GiLoadClass=function(){var all_options={vm:null,io:null,spacing:4,use_query_story:true,default_story:null,set_page_title:true,default_page_title:'Game',game_format_name:'',exit_warning:'The game session has ended.',resources:null,image_info_map:null,proxy_url:'https://zcode.appspot.com/proxy/'};var gameurl=null;var started=false;var GlkOte=null;function load_run(optobj,image,imageoptions){if(!imageoptions){imageoptions={};}
else if(typeof(imageoptions)=='string'){imageoptions={format:imageoptions};}
else{}
var image_format=imageoptions.format;if(!image_format)
image_format='array';all_options.io=window.Glk;all_options.vm=window.Quixe;all_options.GiLoad=this;all_options.GlkOte=null;all_options.GiDispa=null;all_options.Blorb=null;if(!optobj)
optobj=window.game_options;if(optobj&&window.Quixe&&((!optobj.vm)||optobj.vm===window.Quixe)){all_options.engine_name='Quixe';all_options.blorb_gamechunk_type='GLUL';all_options.game_format_name='Glulx';}
if(optobj&&optobj.localize&&optobj.localize.giload_exit_warning){all_options.exit_warning=optobj.localize.giload_exit_warning;}
if(optobj){Object.assign(all_options,optobj);}
if((!all_options.GlkOte)&&window.GlkOteClass){all_options.GlkOte=new window.GlkOteClass();}
if((!all_options.GiDispa)&&window.GiDispaClass){all_options.GiDispa=new window.GiDispaClass();}
if((!all_options.Blorb)&&window.BlorbClass){all_options.Blorb=new window.BlorbClass();}
GlkOte=all_options.GlkOte;if(all_options.resources!=undefined){if(isstring(all_options.resources)){if(window[all_options.resources])
all_options.resources=window[all_options.resources];else
delete all_options.resources;}}
if(all_options.image_info_map!=undefined){if(isstring(all_options.image_info_map)){if(window[all_options.image_info_map])
all_options.image_info_map=window[all_options.image_info_map];else
delete all_options.image_info_map;}}
gameurl=null;if(all_options.use_query_story){var qparams=get_query_params();gameurl=qparams['story'];}
if(!gameurl&&image){GlkOte.log('GiLoad: trying pre-loaded load ('+image_format+')...');switch(image_format){case'base64':image=decode_base64(image);break;case'raw':image=decode_raw_text(image);break;case'array':image=new Uint8Array(image);break;default:all_options.io.fatal_error("Could not decode story file data: "+image_format);return;}
start_game(image);return;}
if(!gameurl){gameurl=all_options.default_story;}
if(!gameurl){if(all_options.story_loader){all_options.story_loader(start_game);}
else{all_options.io.fatal_error("No story file specified!");}
return;}
image=null;var xhr=new XMLHttpRequest();var binary_supported=(xhr.overrideMimeType!==undefined);var crossorigin_supported=(xhr.withCredentials!==undefined);xhr=null;var regex_urldomain=/^(file:|(\w+:)?\/\/[^\/?#]+)/;var page_domain=regex_urldomain.exec(location)[0];var data_exec=regex_urldomain.exec(gameurl);var is_relative=data_exec?false:true;var data_domain=data_exec?data_exec[0]:page_domain;var same_origin=(page_domain==data_domain);if(navigator.userAgent.match(/chrome/i)&&data_domain=='file:'){same_origin=false;}
var old_js_url=gameurl.match(/[.]js$/i);GlkOte.log('GiLoad: is_relative='+is_relative+', same_origin='+same_origin+', binary_supported='+binary_supported+', crossorigin_supported='+crossorigin_supported);if(old_js_url&&same_origin){GlkOte.log('GiLoad: trying old-fashioned load...');window.processBase64Zcode=function(val){start_game(decode_base64(val));};let xhr=new XMLHttpRequest();xhr.addEventListener('load',function(ev){if(xhr.status!=200){all_options.io.fatal_error("The story could not be loaded. ("+gameurl+"): Error: "+xhr.statusText);}
else{globaleval(xhr.response);}});xhr.open('GET',gameurl,true);xhr.setRequestHeader('Accept',"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01");xhr.send();return;}
if(old_js_url){GlkOte.log('GiLoad: trying script load...');window.processBase64Zcode=function(val){start_game(decode_base64(val));};var headls=document.getElementsByTagName('head');if(!headls.length){all_options.io.fatal_error("This page has no <head> element!");return;}
var script=createscriptnode(gameurl);headls[0].appendChild(script);return;}
if(binary_supported&&same_origin){GlkOte.log('GiLoad: trying binary load...');let xhr=new XMLHttpRequest();xhr.addEventListener('load',function(ev){if(xhr.status!=200){all_options.io.fatal_error("The story could not be loaded. ("+gameurl+"): Error: "+xhr.statusText);}
else{start_game(decode_raw_text(xhr.response));}});xhr.open('GET',gameurl,true);xhr.overrideMimeType('text/plain; charset=x-user-defined');xhr.setRequestHeader('Accept',"*/*");xhr.send();return;}
if(data_domain=='file:'){all_options.io.fatal_error("The story could not be loaded. ("+gameurl+"): A local file cannot be sent to the proxy.");return;}
var absgameurl=gameurl;if(is_relative){absgameurl=absolutize(gameurl);GlkOte.log('GiLoad: absolutize '+gameurl+' to '+absgameurl);}
if(crossorigin_supported){GlkOte.log('GiLoad: trying proxy load... ('+all_options.proxy_url+')');let xhr=new XMLHttpRequest();xhr.addEventListener('load',function(ev){if(xhr.status!=200){all_options.io.fatal_error("The story could not be loaded. ("+gameurl+"): Error: "+xhr.statusText);}
else{start_game(decode_base64(xhr.response));}});let queryurl=all_options.proxy_url+'?encode=base64'+'&url='+encodeURIComponent(absgameurl);xhr.open('GET',queryurl,true);xhr.setRequestHeader('Accept',"*/*");xhr.send();return;}
if(true){var fullurl=all_options.proxy_url+'?encode=base64&callback=processBase64Zcode&url='+absgameurl;GlkOte.log('GiLoad: trying proxy-script load... ('+fullurl+')');window.processBase64Zcode=function(val){start_game(decode_base64(val));};var headls=document.getElementsByTagName('head');if(!headls.length){all_options.io.fatal_error("This page has no <head> element!");return;}
var script=createscriptnode(fullurl);headls[0].appendChild(script);return;}
all_options.io.fatal_error("The story could not be loaded. ("+gameurl+"): I don't know how to load this data.");}
function get_query_params(){var map={};var qs=location.search.substring(1,location.search.length);if(qs.length){var args=qs.split('&');qs=qs.replace(/\+/g,' ');for(var ix=0;ix<args.length;ix++){var pair=args[ix].split('=');var name=decodeURIComponent(pair[0]);var value=(pair.length==2)?decodeURIComponent(pair[1]):name;map[name]=value;}}
return map;}
function absolutize(url){var res=new URL(url,document.location.href);return res.href;}
function isstring(val){return(typeof val==='string'||val instanceof String);}
function globaleval(data){(window.execScript||function(data){window["eval"].call(window,data);})(data);}
function createscriptnode(url){var el=document.createElement('script');el.setAttribute('type','text/javascript');el.setAttribute('src',url);return el;}
function decode_raw_text(str){var arr=new Uint8Array(str.length);var ix;for(ix=0;ix<str.length;ix++){arr[ix]=str.charCodeAt(ix)&0xFF;}
return arr;}
function decode_base64(base64data)
{var data=atob(base64data);var image=new Uint8Array(data.length);var ix;for(ix=0;ix<data.length;ix++)
image[ix]=data.charCodeAt(ix);return image;}
function start_game(image){if(image.length==0){all_options.io.fatal_error("No game file was loaded. (Zero-length response.)");return;}
if(image[0]==0x46&&image[1]==0x4F&&image[2]==0x52&&image[3]==0x4D){var formtype=String.fromCharCode(image[8],image[9],image[10],image[11]);if(formtype=='IFZS'){all_options.io.fatal_error("This is a saved-game file, not a "+all_options.game_format_name+" game file. You must launch the game first, then restore your save.");return;}
if(formtype!='IFRS'){all_options.io.fatal_error("This IFF file is not a Blorb file!");return;}
if(all_options.blorb_gamechunk_type){if(!all_options.Blorb){all_options.io.fatal_error("Blorb file could not be parsed because no BlorbClass is available.");return;}
try{var retainuses={'exec':true,'pict':true,'data':true,'sound':true};if(all_options.retainuses!==undefined){retainuses=all_options.retainuses;}
all_options.Blorb.init(image,{format:'blorbbytes',retainuses:retainuses});image=all_options.Blorb.get_exec_data(all_options.blorb_gamechunk_type);}
catch(ex){all_options.io.fatal_error("Blorb file could not be parsed: "+ex);return;}}
if(!image){all_options.io.fatal_error("Blorb file contains no "+all_options.game_format_name+" game!");return;}}
if(all_options.Blorb&&!all_options.Blorb.inited()){if(all_options.image_info_map){all_options.Blorb.init(all_options.image_info_map,{format:'infomap'});}
else if(all_options.resources){all_options.Blorb.init(all_options.resource_array);}
else{all_options.Blorb.init([]);}}
{var title=null;if(all_options.Blorb)
title=all_options.Blorb.get_metadata('title');if(!title&&gameurl)
title=gameurl.slice(gameurl.lastIndexOf("/")+1);if(!title)
title=all_options.default_page_title;if(!title)
title='Game';if(!all_options.recording_label)
all_options.recording_label=title;if(all_options.set_page_title)
document.title=title+" - "+all_options.engine_name;}
all_options.vm.init(image,all_options);started=true;all_options.io.init(all_options);}
function is_inited(){return started;}
function get_library(val){switch(val){case'GlkOte':return GlkOte;case'GiDispa':return all_options.GiDispa;case'Blorb':return all_options.Blorb;case'VM':return all_options.vm;case'IO':return all_options.io;}
return null;}
return{classname:'GiLoad',load_run:load_run,inited:is_inited,getlibrary:get_library,};};var GiLoad=new GiLoadClass();try{exports.GiLoad=GiLoad;exports.GiLoadClass=GiLoadClass;}catch(ex){};

/* ---------------- Подпись игры (id папки сейвов) ----------------
   Quixe берёт первые 64 байта чанка GLUL и печатает их как hex, но пишет
   результат обратно в типизированный массив: буквы превращаются в 0.
   Воспроизводим это точно — сейвы движка лежат в папке именно с таким id. */

function readU32(u8, p) {
  return ((u8[p] << 24) | (u8[p + 1] << 16) | (u8[p + 2] << 8) | u8[p + 3]) >>> 0;
}

/* Для Blorb ищем чанк GLUL: подпись игры — внутри него, а не в шапке файла. */
function glulDataStart(u8) {
  var start = 0;
  if (u8.length > 12 &&
      String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === 'FORM' &&
      String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) === 'IFRS') {
    var p = 12;
    while (p + 8 <= u8.length) {
      var id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
      var size = readU32(u8, p + 4);
      if (id === 'GLUL') { start = p + 8; break; }
      p += 8 + size + (size & 1);
    }
  }
  return start;
}

function storySignature(u8) {
  var start = glulDataStart(u8);
  if (start + 64 > u8.length) return '';
  var s = '';
  for (var i = 0; i < 64; i++) {
    var h = u8[start + i].toString(16);
    s += h.length < 2 ? '0' + h : h;
  }
  return s;
}

function vmSignature(u8) {
  var start = glulDataStart(u8);
  if (start + 64 > u8.length) return '';
  var s = '';
  for (var i = 0; i < 64; i++) {
    var n = Number(u8[start + i].toString(16));
    s += String(isNaN(n) ? 0 : n);
  }
  return s;
}

/* ---------------- Контракт модуля (engines/README.md) ----------------
   Ядро грузит этот файл лениво и вызывает только эти методы. */

window.GlulxEngine = {
  id: 'glulx',
  name: 'Glulx',
  version: '2.2.6',

  /* id папки сейвов — считается по байтам игры, до запуска VM. */
  getSignature: function (u8) { return vmSignature(u8); },

  /* Прежняя «сырая» подпись: нужна ядру для поиска старых сейвов. */
  getStorySignature: function (u8) { return storySignature(u8); },

  init: function (opts) {
    var u8 = opts && opts.gameBytes;
    if (!u8) { if (opts && opts.onError) opts.onError('no game data'); return; }
    try {
      window.game_options = {
        use_query_story: false,
        set_page_title: false,
        game_format_name: 'Glulx',
        localize: (opts && opts.localize) || {}
      };
      GiLoad.load_run(window.game_options, u8, { format: 'array' });
    } catch (e) {
      if (opts && opts.onError) opts.onError((e && e.message) || e);
      return;
    }
    if (opts && opts.onReady) opts.onReady();
  }
};

/* GiLoad собирает рантайм сам и ищет классы/инстансы в window — так было
   и до выноса модуля. Ядро берёт отсюда Dialog (патч сейвов) и подпись VM. */
window.GlkOteClass = GlkOteClass;
window.DialogClass = DialogClass;
window.BlorbClass = BlorbClass;
window.GlkClass = GlkClass;
window.GiDispaClass = GiDispaClass;
window.GiLoadClass = GiLoadClass;

window.GlkOte = GlkOte;
window.Dialog = Dialog;
window.Glk = Glk;
window.Quixe = Quixe;
window.GiLoad = GiLoad;

})();
