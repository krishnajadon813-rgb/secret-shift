/* Lightweight, dependency-free WebGL 1 renderer for the offline station. */
(() => {
  'use strict';
  const vert = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uViewProjection;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying float vFog;
    void main() {
      vec4 view = uViewProjection * vec4(aPosition, 1.0);
      gl_Position = view;
      vColor = aColor;
      vNormal = aNormal;
      vFog = clamp((-view.z - 12.0) / 50.0, 0.0, 0.7);
    }`;
  const frag = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying float vFog;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 light = normalize(vec3(-0.4, 0.9, 0.5));
      float diffuse = max(dot(n, light), 0.0);
      float shade = 0.55 + diffuse * 0.55;
      vec3 color = vColor * shade;
      color = mix(color, vec3(0.025, 0.045, 0.09), vFog);
      gl_FragColor = vec4(color, 1.0);
    }`;

  const C = {
    navy:'#071426', floor:'#101b30', steel:'#526b84', bright:'#8ea9c3', mint:'#67e4ce',
    violet:'#a878ff', amber:'#ffad52', blue:'#56bfff', green:'#54dfa6', pink:'#f45c81',
    white:'#dff5ff', black:'#101722'
  };
  const colors = ['#ba8cff','#ffc36c','#67e6dc'];
  const rooms = [
    {x:0,y:0,w:315,h:214,c:'#203449',l:'#a580ff', name:'PRISM LAB'},
    {x:327,y:0,w:306,h:214,c:'#263943',l:'#73d8e6', name:'OBSERVATORY'},
    {x:645,y:0,w:315,h:214,c:'#383446',l:'#ffb35c', name:'SUN GARDEN'},
    {x:0,y:386,w:315,h:214,c:'#302c45',l:'#72dbca', name:'CREW QUARTERS'},
    {x:327,y:386,w:306,h:214,c:'#1c3540',l:'#71e0dc', name:'ECHO VAULT'},
    {x:645,y:386,w:315,h:214,c:'#3a2c3d',l:'#d387ff', name:'SIGNAL CORE'}
  ];
  const hex = color => {
    if (Array.isArray(color)) return color;
    const value = color.replace('#','');
    return [0,2,4].map(i => parseInt(value.slice(i,i+2),16)/255);
  };
  const matMul = (a,b) => {
    const out = new Float32Array(16);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  };
  const perspective = (fov,aspect,near,far) => {
    const f=1/Math.tan(fov/2), nf=1/(near-far), out=new Float32Array(16);
    out[0]=f/aspect;out[5]=f;out[10]=(far+near)*nf;out[11]=-1;out[14]=2*far*near*nf;
    return out;
  };
  const lookAt = (eye,center,up=[0,1,0]) => {
    let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2],len=Math.hypot(zx,zy,zz)||1;zx/=len;zy/=len;zz/=len;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;len=Math.hypot(xx,xy,xz)||1;xx/=len;xy/=len;xz/=len;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  };
  const compile=(gl,type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'3D shader could not compile');return s;};
  const programFor=gl=>{const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vert));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,frag));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'3D shader could not link');return p;};

  class Scene3D {
    constructor(canvas,gl) {
      this.canvas=canvas;this.gl=gl;this.program=programFor(gl);gl.useProgram(this.program);
      this.aPos=gl.getAttribLocation(this.program,'aPosition');this.aNorm=gl.getAttribLocation(this.program,'aNormal');this.aCol=gl.getAttribLocation(this.program,'aColor');this.uMatrix=gl.getUniformLocation(this.program,'uViewProjection');
      this.buffer=gl.createBuffer();this.staticData=null;this.level=-1;this.shifted=false;this.targetYaw=0;this.yaw=0;this.pitch=.55;this.targetPitch=.55;this.zoom=9.4;this.targetZoom=9.4;this.lastFrame=0;this.frames=0;this.vertices=0;this.spheres=0;this.freeLookUntil=0;
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.025,.045,.085,1);
      this.upgradeKey='';this.buildStation(1,false,{});
      canvas.style.touchAction='none';
      canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0&&!e.target.closest?.('button,.overlay,.touch-controls,.camera-drag-zone')){this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
      canvas.addEventListener('pointermove',e=>{if(this.drag?.id===e.pointerId){this.orbit(e.clientX-this.drag.x,e.clientY-this.drag.y);this.drag.x=e.clientX;this.drag.y=e.clientY;}});
      const end=e=>{if(this.drag?.id===e.pointerId)this.drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
      canvas.addEventListener('wheel',e=>{e.preventDefault();this.targetZoom=Math.max(7,Math.min(15,this.targetZoom+Math.sign(e.deltaY)*.7));},{passive:false});
    }
    orbit(dx,dy) { this.targetYaw+=dx*.008;this.targetPitch=Math.max(.2,Math.min(.86,this.targetPitch+dy*.004));this.freeLookUntil=performance.now()+4500; }
    recenter() { this.targetYaw=0;this.targetPitch=.55;this.targetZoom=9.4;this.freeLookUntil=0; }
    cameraRelativeVector(x,y,referenceYaw=this.yaw) { const c=Math.cos(referenceYaw),s=Math.sin(referenceYaw);return {x:x*c+y*s,y:-x*s+y*c}; }
    xy(px,py,y=0) { return [(px-480)/32,y,(py-300)/32]; }
    batch() { return []; }
    tri(out,a,b,c,color,normal) { const col=hex(color);for(const p of [a,b,c])out.push(p[0],p[1],p[2],normal[0],normal[1],normal[2],col[0],col[1],col[2]); }
    box(out,x,y,z,w,h,d,color,rot=0) {
      const c=Math.cos(rot),s=Math.sin(rot),point=(a,b,e)=>[x+a*c+e*s,y+b,z-a*s+e*c];
      const a=-w/2,b=w/2,lo=-h/2,hi=h/2,n=-d/2,f=d/2;
      const faces=[[[a,lo,n],[a,hi,n],[b,hi,n],[b,lo,n],[0,0,-1]],[[b,lo,f],[b,hi,f],[a,hi,f],[a,lo,f],[0,0,1]],[[a,lo,f],[a,hi,f],[a,hi,n],[a,lo,n],[-1,0,0]],[[b,lo,n],[b,hi,n],[b,hi,f],[b,lo,f],[1,0,0]],[[a,hi,n],[a,hi,f],[b,hi,f],[b,hi,n],[0,1,0]],[[a,lo,f],[a,lo,n],[b,lo,n],[b,lo,f],[0,-1,0]]];
      for(const face of faces){const vs=face.slice(0,4).map(p=>point(...p)),nn=face[4],normal=[nn[0]*c+nn[2]*s,nn[1],-nn[0]*s+nn[2]*c];this.tri(out,vs[0],vs[1],vs[2],color,normal);this.tri(out,vs[0],vs[2],vs[3],color,normal);}
    }
    sphere(out,x,y,z,r,color,rot=0,seg=8,rings=5) {
      this.spheres++;const col=hex(color),c=Math.cos(rot),s=Math.sin(rot),v=[];
      for(let j=0;j<=rings;j++){const ph=j/rings*Math.PI, row=[];for(let i=0;i<=seg;i++){const th=i/seg*Math.PI*2,nx=Math.sin(ph)*Math.cos(th),ny=Math.cos(ph),nz=Math.sin(ph)*Math.sin(th);row.push({p:[x+r*(nx*c+nz*s),y+r*ny,z+r*(-nx*s+nz*c)],n:[nx*c+nz*s,ny,-nx*s+nz*c]});}v.push(row);}
      for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=v[j][i],b=v[j+1][i],cc=v[j+1][i+1],d=v[j][i+1];for(const p of [a,b,d,b,cc,d])out.push(...p.p,...p.n,...col);}
    }
    cylinder(out,x,y,z,r,h,color,seg=10) {
      const col=hex(color),bottom=y-h/2,top=y+h/2;
      for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,pa=[x+Math.cos(a)*r,bottom,z+Math.sin(a)*r],pb=[x+Math.cos(b)*r,bottom,z+Math.sin(b)*r],ta=[pa[0],top,pa[2]],tb=[pb[0],top,pb[2]],nm=[Math.cos((a+b)/2),0,Math.sin((a+b)/2)];this.tri(out,pa,ta,tb,color,nm);this.tri(out,pa,tb,pb,color,nm);this.tri(out,[x,top,z],tb,ta,color,[0,1,0]);}
    }
    pxBox(out,x,y,w,h,cy,height,color,rot=0) { const p=this.xy(x+w/2,y+h/2,cy);this.box(out,p[0],p[1],p[2],w/32,height,h/32,color,rot); }
    buildStation(level,shifted,upgrades={}) {
      const out=[],alt=level%2===0,grass=alt?'#587e63':'#477a61',path=alt?'#b39a78':'#b9ad89';
      const strip=(x,y,w,h,c,height=.13)=>{const p=this.xy(x,y,.1);this.box(out,p[0],p[1],p[2],w/32,height,h/32,c);};
      this.box(out,0,-1.05,0,38,.2,26,'#12334a');this.box(out,0,-.56,0,30,.8,18.8,'#354d51');this.box(out,0,-.08,0,29.8,.25,18.45,grass);
      for(let i=0;i<18;i++){const a=i/18*Math.PI*2,x=Math.cos(a)*14,z=Math.sin(a)*8.6;this.sphere(out,x,-.52,z,.9+i%3*.13,i%2?'#394a4c':'#475554',0,7,4);this.cylinder(out,x,-.68,z,.19,.6,'#293d49',7);}
      // Biome clearings and broad paths connect the garden, market, habitat and secret grove.
      strip(185,132,260,210,shifted?'#63574f':'#637e62');strip(783,140,315,230,grass);strip(780,468,305,220,'#588261');strip(480,300,330,160,shifted?'#745f77':'#b3a179');strip(474,490,280,180,shifted?'#564168':'#71815e');
      strip(480,300,690,48,path);strip(480,300,64,465,path);
      if(!alt){strip(626,302,170,27,'#27747a');strip(630,302,116,18,'#55c8bf');strip(470,83,66,150,'#267f88');strip(470,167,100,23,'#4bd1c9');strip(476,528,110,25,'#348c91');}
      else{strip(318,270,44,420,'#246e7c');strip(318,272,24,310,'#4ac7bf');strip(318,410,150,28,'#27747a');strip(352,410,130,16,'#69d8c2');strip(735,300,54,175,'#267783');strip(735,374,110,24,'#68c5b3');}
      strip(480,303,168,34,shifted?'#aa6fc2':'#877453');
      const house=(px,py,w,d,wall,roof)=>{const p=this.xy(px,py,.25),x=p[0],z=p[2];this.box(out,x,.78,z,w,.98,d,wall);this.box(out,x,1.33,z,w+.16,.16,d+.16,roof);this.box(out,x,1.52,z,w*.44,.22,.06,'#85dccc');this.box(out,x-w*.28,.8,z+d/2+.03,.28,.36,.05,'#f6c874');};
      house(800,135,2.55,1.8,'#bdd6b9','#437b83');house(798,465,2.7,1.65,'#bc9869','#da9c50');house(478,300,2.2,1.6,'#a6d2c4','#467f83');
      const bed=(px,py)=>{const p=this.xy(px,py,.35);this.box(out,p[0],p[1],p[2],1,.3,.68,'#65523d');this.box(out,p[0],p[1]+.18,p[2],.92,.08,.6,'#315d4b');for(const dx of [-.27,0,.27]){this.cylinder(out,p[0]+dx,p[1]+.4,p[2],.05,.42,'#4fa36e',7);this.sphere(out,p[0]+dx,p[1]+.66,p[2],.18,dx===0?'#efa24d':'#82c96e',0,7,4);}};
      const beds=[[697,175],[758,190],[850,190],[714,426],[769,427],[855,425],[410,355],[547,354],[410,248],[550,248]];if((upgrades.garden||0)>0)beds.push([670,232],[880,225],[720,475]);for(const [x,y] of beds)bed(x,y);
      // Layered tree canopies and visible fruit trees frame the paths without external art.
      const tree=(px,py,r,leaf)=>{const p=this.xy(px,py,.24),x=p[0],z=p[2];this.cylinder(out,x,.65,z,.12,1.18,'#76563d',7);this.sphere(out,x,.99,z,r,leaf,0,8,5);this.sphere(out,x-r*.5,1.15,z+r*.18,r*.68,'#61a96d',0,7,4);this.sphere(out,x+r*.46,1.12,z-r*.2,r*.64,'#377d58',0,7,4);this.sphere(out,x-r*.18,.91,z-r*.48,.09,'#f9c86f',0,6,4);};
      const forest=[[52,80,1.04,'#377e59'],[103,183,.86,'#4b9862'],[260,72,.94,'#478c5e'],[334,156,.78,'#58a56a'],[615,86,.92,'#418255'],[700,70,1.06,'#367a56'],[909,85,.96,'#39825c'],[917,243,.82,'#58a965'],[88,403,.96,'#397c57'],[174,524,1.05,'#3e8b5c'],[288,460,.84,'#5b9c62'],[685,525,.95,'#378358'],[913,525,1.08,'#3e855b'],[335,526,.84,'#4e985f'],[578,525,.86,'#4b8d5b']];if(alt)forest.push([65,274,.95,'#a05f86'],[126,310,.8,'#805c9b'],[248,349,.78,'#9c7092'],[575,525,.86,'#7c6196'],[770,530,1.03,'#8c6494'],[865,280,.77,'#ae6880'],[378,73,.72,'#7b70ad']);for(const t of forest)tree(...t);
      const machine=(px,py,color)=>{const p=this.xy(px,py,.38);this.box(out,p[0],p[1],p[2],1.5,.85,1.05,'#536a5d');this.box(out,p[0],p[1]+.51,p[2],1.22,.12,.8,'#ced6b2');this.box(out,p[0],p[1]+.68,p[2],.55,.24,.1,color);this.cylinder(out,p[0],p[1]+.3,p[2],.29,.08,color,12);if((upgrades.solar||0)>0)this.cylinder(out,p[0],p[1]+.79,p[2],.55,.07,'#ffe38b',12);};machine(165,138,'#c580e5');machine(805,148,'#f3c366');machine(795,476,'#67e7cf');
      // Original wooden nature-market frontage: open sides keep the real stocked displays visible.
      const shop=this.xy(480,145,.3),sx=shop[0],sz=shop[2];
      this.box(out,sx,.24,sz,6.1,.3,2.75,'#584337');
      this.box(out,sx,.94,sz-.98,5.65,1.45,.16,'#79583f');
      this.box(out,sx,.83,sz-.87,5.35,.94,.08,'#b57c50');
      this.box(out,sx,.66,sz-.78,4.98,.12,.1,'#d7ae72');
      for(const dx of [-2.75,2.75]){
        this.box(out,sx+dx,.98,sz+.12,.17,1.75,.18,'#654936');
        this.box(out,sx+dx,.23,sz+.12,.34,.2,.38,'#584337');
      }
      // Low pitched green roof, visible from the follow camera.
      this.box(out,sx,.1+1.83,sz,6.15,.2,3.25,'#385b46');
      this.box(out,sx,1.99,sz,4.65,.12,2.9,'#537950');
      this.box(out,sx,2.17,sz-.08,1.95,.48,.16,'#e3c982');
      this.box(out,sx,2.17,sz+.015,1.72,.3,.1,'#32664f');
      this.box(out,sx,2.17,sz+.075,1.28,.08,.04,'#e7efce');
      for(const dx of [-2.35,-1.55,1.55,2.35]){
        this.box(out,sx+dx,1.18,sz+.08,.11,.78,.12,'#d09a64');
        this.sphere(out,sx+dx,1.72,sz+.25,.13,'#ffd27e',0,7,4);
      }
      for(const dx of [-2.35,2.35]){
        this.box(out,sx+dx,.36,sz+.5,.76,.27,.52,'#6f523b');
        this.sphere(out,sx+dx,.72,sz+.5,.29,dx<0?'#4e9a62':'#67ad6a',0,7,4);
      }
      const marketShelf=(px,py,wood)=>{const p=this.xy(px,py,.32);this.box(out,p[0],p[1]+.3,p[2],1.72,.62,.58,wood);this.box(out,p[0],p[1]+.64,p[2],1.86,.1,.68,'#d8bd83');this.box(out,p[0]-.52,p[1]+.88,p[2],.12,.46,.56,wood);this.box(out,p[0]+.52,p[1]+.88,p[2],.12,.46,.56,wood);};marketShelf(398,242,'#73583f');marketShelf(562,242,'#526e58');marketShelf(480,185,'#445d71');
      const shrine=this.xy(480,500,.3);this.cylinder(out,shrine[0],.31,shrine[2],1.25,.22,shifted?'#7651a4':'#456d62',12);this.cylinder(out,shrine[0],.5,shrine[2],.82,.18,shifted?'#b34de0':'#61bd9d',10);this.box(out,shrine[0],1.1,shrine[2],.18,1.1,.18,'#9b78b5');this.sphere(out,shrine[0],1.87,shrine[2],.46,shifted?'#d873ff':'#91d9a4',0,9,6);
      for(const [x,y,c] of [[370,95,'#d88eff'],[575,120,'#71e8db'],[660,333,'#e6b25d'],[286,318,'#82e5bd'],[868,315,'#e88bbd'],[223,380,'#a3e986'],[732,303,'#73e9dd'],[566,450,'#e8a9ea']]){const p=this.xy(x,y,.34);this.sphere(out,p[0],.49,p[2],.22,c,0,7,4);this.cylinder(out,p[0],.26,p[2],.035,.32,'#5ca879',6);}
      for(const x of [444,516]){const p=this.xy(x,500,.22);this.box(out,p[0],.43,p[2],.08,.48,2.15,shifted?'#ba7ce0':'#718a7a');}if(!shifted){const p=this.xy(480,500,.3);this.box(out,p[0],.52,p[2]+.92,1.55,.75,.12,'#6b6177');}
      if((upgrades.habitat||0)>0){for(const [x,y] of [[885,460],[904,455],[875,505]]){const p=this.xy(x,y,.33);this.box(out,p[0],p[1],p[2],.5,.26,.5,'#6b5745');this.sphere(out,p[0],p[1]+.4,p[2],.27,'#58b77b',0,7,4);}}
      this.staticData=new Float32Array(out);this.level=level;this.shifted=shifted;this.upgradeKey=JSON.stringify(upgrades);
    }
    addKeeper(out,person,t) {
      const p=this.xy(person.x,person.y,.2),x=p[0],z=p[2],bob=Math.sin(t*2.2+x*3)*.035;
      this.cylinder(out,x,.17,z,.32,.05,'#445b50',10);this.box(out,x,.66+bob,z,.48,.62,.4,person.color||'#72dbc9');this.box(out,x,.58+bob,z+.07,.27,.28,.08,'#ecf3db');this.box(out,x-.34,.64+bob,z,.14,.4,.16,'#d0d8c8');this.box(out,x+.34,.64+bob,z,.14,.4,.16,'#d0d8c8');this.sphere(out,x,.99+bob,z,.26,'#e5dfc6',0,8,5);this.sphere(out,x,.99+bob,z+.18,.17,'#3d7281',0,8,5);this.sphere(out,x-.05,.99+bob,z+.31,.04,'#a9f8dc',0,6,4);this.box(out,x-.27,1.18+bob,z,.11,.13,.12,'#f0be77');this.box(out,x+.27,1.18+bob,z,.11,.13,.12,'#f0be77');
    }
    addShopper(out,person,t){
      const p=this.xy(person.x,person.y,.2),x=p[0],z=p[2],v=((person.variant||0)%6+6)%6;
      const looks=person.helper?{skin:'#d7a47f',hair:'#49332b',top:'#39775b',pants:'#42423c',accent:'#e4c978',kind:'staff'}:[
        {skin:'#d69a6d',hair:'#594039',top:'#66844b',pants:'#554839',accent:'#d39a54',kind:'hat'},
        {skin:'#f0c59d',hair:'#46352f',top:'#477f9d',pants:'#35465b',accent:'#e9bf69',kind:'pack'},
        {skin:'#b97855',hair:'#262832',top:'#765b8e',pants:'#414457',accent:'#7bd7ca',kind:'lab'},
        {skin:'#dcb394',hair:'#8a8072',top:'#9a7354',pants:'#665848',accent:'#c2a76d',kind:'elder'},
        {skin:'#8f5945',hair:'#321f24',top:'#bd6570',pants:'#49313f',accent:'#f4ca75',kind:'scarf'},
        {skin:'#edc7a5',hair:'#62402d',top:'#3e7463',pants:'#3e4543',accent:'#d58c57',kind:'satchel'}
      ][v],bob=Math.sin(t*2.4+x*2.1+(person.variant||0))*.027,walk=person.walking?Math.sin(t*10)*.09:Math.sin(t*1.8+x)*.018;
      const h=person.height||(v===3?.92:v===1?1.08:1),Y=n=>n*h;
      const ground=Y(.12)+.025;this.cylinder(out,x,ground,z,.3*h,.05,'#536552',9);
      // Distinct outfit silhouettes and proportions make this a small cast, not six palette swaps.
      this.box(out,x,Y(.77)+bob,z,.48*h,.57*h,.34*h,looks.top);
      this.box(out,x,Y(.74)+bob,z+.185*h,.28*h,.38*h,.045,'#eadfc9');
      this.box(out,x,Y(.38)+walk,z-.035*h,.18*h,.43*h,.2*h,looks.pants);
      this.box(out,x,Y(.38)-walk,z+.055*h,.18*h,.43*h,.2*h,looks.pants);
      this.box(out,x-.18*h,Y(.13)+Math.max(0,walk),z+.05*h,.25*h,.17*h,.34*h,'#5a4034');
      this.box(out,x+.18*h,Y(.13)+Math.max(0,-walk),z+.14*h,.25*h,.17*h,.34*h,'#5a4034');
      this.box(out,x-.34*h,Y(.77)+bob+walk*.45,z+.025*h,.16*h,.48*h,.18*h,looks.top);
      this.box(out,x+.34*h,Y(.77)+bob-walk*.45,z+.025*h,.16*h,.48*h,.18*h,looks.top);
      this.sphere(out,x,Y(1.22)+bob,z,.245*h,looks.skin,0,9,6);
      this.sphere(out,x,Y(1.36)+bob,z-.045*h,.25*h,looks.hair,0,8,5);
      this.sphere(out,x-.115*h,Y(1.19)+bob,z+.193*h,.035*h,'#fff4da',0,6,4);
      this.sphere(out,x+.055*h,Y(1.19)+bob,z+.193*h,.035*h,'#fff4da',0,6,4);
      this.sphere(out,x-.104*h,Y(1.19)+bob,z+.221*h,.017*h,'#344054',0,6,4);
      this.sphere(out,x+.066*h,Y(1.19)+bob,z+.221*h,.017*h,'#344054',0,6,4);
      if(looks.kind==='hat'){
        this.cylinder(out,x,Y(1.48)+bob,z,.31*h,.12*h,looks.accent,9);
        this.sphere(out,x,Y(1.52)+bob,z,.2*h,looks.accent,0,8,5);
      }else if(looks.kind==='pack'){
        this.box(out,x,Y(.79)+bob,z-.23*h,.34*h,.4*h,.18*h,'#bf684e');
        this.box(out,x,Y(.84)+bob,z-.335*h,.22*h,.14*h,.04,looks.accent);
      }else if(looks.kind==='lab'){
        this.box(out,x,Y(.77)+bob,z-.205*h,.2*h,.4*h,.1*h,'#c6d2d5');
        this.box(out,x,Y(1.2)+bob,z+.24*h,.26*h,.1*h,.04,'#8de2ed');
      }else if(looks.kind==='elder'){
        this.box(out,x+.35*h,Y(.48),z+.04*h,.07*h,.78*h,.08*h,'#805f47');
        this.sphere(out,x,Y(1.42)+bob,z,.26*h,'#a9a49a',0,8,5);
      }else if(looks.kind==='scarf'){
        this.box(out,x,Y(.96)+bob,z+.21*h,.44*h,.12*h,.07*h,looks.accent);
      }else if(looks.kind==='staff'){
        this.box(out,x,Y(.68)+bob,z+.222*h,.35*h,.38*h,.055,'#d9e1d2');
        this.cylinder(out,x,Y(1.48)+bob,z,.29*h,.1*h,'#4a7fbe',9);
        this.box(out,x,Y(1.53)+bob,z+.08*h,.29*h,.04*h,.12*h,'#4a7fbe');
        this.box(out,x,Y(.52)+bob,z+.25*h,.1*h,.08*h,.035,'#e4c978');
      }else{
        this.box(out,x+.32*h,Y(.62)+bob,z+.1*h,.2*h,.25*h,.12*h,'#8c5c3e');
        this.box(out,x+.32*h,Y(.76)+bob,z+.18*h,.23*h,.05*h,.04,looks.accent);
      }
    }
    addRelay(out,o,t) {
      if(o.done)return;const p=this.xy(o.x,o.y,.18),accent=colors[o.i],pulse=1+Math.sin(t*3+o.i)*.055;
      this.cylinder(out,p[0],.16,p[2],.74*pulse,.18,'#344965',12);this.cylinder(out,p[0],.29,p[2],.54*pulse,.12,accent,12);this.cylinder(out,p[0],.43,p[2],.22,.35,'#e1f4ff',10);this.sphere(out,p[0],.73,p[2],.25,accent,0,8,5);
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])this.box(out,p[0]+Math.cos(a)*.52,.55,p[2]+Math.sin(a)*.52,.07,.62,.07,accent);
      this.box(out,p[0],1.25,p[2],.08,.95,.08,'#9db7d2');this.box(out,p[0],1.75,p[2],.55,.12,.55,accent);
    }
    addExplorer(out,state,t) {
      const p=this.xy(state.player.x,state.player.y,.13),walk=state.moving?Math.sin(state.player.walk*2)*.12:Math.sin(t*2)*.035,yaw=Math.PI-(state.player.heading||0),x=p[0],z=p[2];
      // Reference-led original explorer: warm face, swept brown hair, green field jacket,
      // cream emblem shirt, work trousers, gloves, boots and a compact trail pack.
      this.cylinder(out,x,.15,z,.39,.04,'#536552',12);
      this.box(out,x,.9+Math.abs(walk)*.12,z,.54,.62,.39,'#365f4e',yaw);
      this.box(out,x,.88+Math.abs(walk)*.12,z+.205,.36,.43,.045,'#e8e0c9',yaw);
      this.box(out,x,.91+Math.abs(walk)*.12,z+.24,.07,.25,.035,'#345d4c',yaw);
      this.box(out,x-.18,.33+walk,z+.08,.2,.53,.23,'#4a4640',yaw);this.box(out,x+.18,.33-walk,z+.08,.2,.53,.23,'#3d3935',yaw);
      this.box(out,x-.19,.11+Math.max(0,walk),z+.17,.29,.18,.4,'#634334',yaw);this.box(out,x+.19,.11+Math.max(0,-walk),z+.17,.29,.18,.4,'#634334',yaw);
      this.box(out,x,.79,z-.33,.51,.49,.31,'#80583d',yaw);this.box(out,x,.83,z-.52,.4,.37,.14,'#ad714b',yaw);
      this.box(out,x-.37,.87+walk*.5,z,.18,.45,.2,'#365f4e',yaw);this.box(out,x-.37,.58+walk*.5,z+.12,.19,.17,.21,'#49372c',yaw);
      this.box(out,x+.37,.87-walk*.5,z,.18,.45,.2,'#365f4e',yaw);this.box(out,x+.37,.58-walk*.5,z+.12,.19,.17,.21,'#49372c',yaw);
      this.sphere(out,x,1.51,z+.08,.31,'#dba27c',yaw,10,7);
      this.sphere(out,x,1.66,z-.025,.32,'#543b31',yaw,10,6);
      this.sphere(out,x-.14,1.54,z+.295,.042,'#fff6df',yaw,7,5);this.sphere(out,x+.105,1.54,z+.295,.042,'#fff6df',yaw,7,5);
      this.sphere(out,x-.13,1.54,z+.329,.02,'#392f2b',yaw,7,5);this.sphere(out,x+.115,1.54,z+.329,.02,'#392f2b',yaw,7,5);
      this.sphere(out,x,1.43,z+.322,.035,'#bd7959',yaw,7,5);
      this.box(out,x,1.36,z+.317,.12,.035,.035,'#8d5048',yaw);
      // Distinctive amber trail goggles sit on the hairline instead of replacing the face with a helmet.
      this.box(out,x,1.86,z+.025,.48,.07,.09,'#76513c',yaw);
      this.sphere(out,x-.12,1.86,z+.075,.09,'#d99c4f',yaw,8,5);this.sphere(out,x+.12,1.86,z+.075,.09,'#d99c4f',yaw,8,5);
      this.sphere(out,x-.12,1.86,z+.115,.053,'#79bfd0',yaw,8,5);this.sphere(out,x+.12,1.86,z+.115,.053,'#79bfd0',yaw,8,5);
      // Simple white leaf-mark on the chest for a readable original silhouette.
      this.box(out,x-.045,.91,z+.245,.045,.21,.035,'#fff4dc',yaw);this.box(out,x+.035,.91,z+.245,.045,.21,.035,'#fff4dc',yaw+.42);
    }
    drawBatch(data,matrix,usage) {
      const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const stride=9*4;
      gl.enableVertexAttribArray(this.aPos);gl.vertexAttribPointer(this.aPos,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(this.aNorm);gl.vertexAttribPointer(this.aNorm,3,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(this.aCol);gl.vertexAttribPointer(this.aCol,3,gl.FLOAT,false,stride,24);gl.uniformMatrix4fv(this.uMatrix,false,matrix);gl.drawArrays(gl.TRIANGLES,0,data.length/9);return data.length/9;
    }
    render(state,t) {
      const gl=this.gl,upgradeKey=JSON.stringify(state.upgrades||{});if(state.level!==this.level||state.shifted!==this.shifted||upgradeKey!==this.upgradeKey)this.buildStation(state.level,state.shifted,state.upgrades||{});
      const dt=this.lastFrame?Math.min(.05,(t-this.lastFrame)/1000):.016;this.lastFrame=t;if(state.menuView!==this.menuView){this.menuView=state.menuView;this.targetZoom=this.menuView?18:9.4;this.targetPitch=.55;}const autoFollow=state.menuView?false:state.followCamera!==false&&performance.now()>this.freeLookUntil;if(state.menuView)this.targetYaw=0;else if(autoFollow)this.targetYaw=-(state.player.heading||0);const turn=((this.targetYaw-this.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;this.yaw+=turn*Math.min(1,dt*4);this.pitch+=(this.targetPitch-this.pitch)*Math.min(1,dt*7);this.zoom+=(this.targetZoom-this.zoom)*Math.min(1,dt*6);
      const width=this.canvas.clientWidth||960,height=this.canvas.clientHeight||600,dpr=Math.min(1.5,window.devicePixelRatio||1),rw=Math.max(1,Math.floor(width*dpr)),rh=Math.max(1,Math.floor(height*dpr));if(this.canvas.width!==rw||this.canvas.height!==rh){this.canvas.width=rw;this.canvas.height=rh;}
      gl.viewport(0,0,rw,rh);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const p=this.xy(state.player.x,state.player.y,.15),heading=state.player.heading||0,target=[p[0]+Math.sin(heading)*1.3,.76,p[2]-Math.cos(heading)*1.3],horizontal=this.zoom*Math.cos(this.pitch),cameraYaw=this.yaw,eye=[target[0]+Math.sin(cameraYaw)*horizontal,target[1]+this.zoom*Math.sin(this.pitch),target[2]+Math.cos(cameraYaw)*horizontal];
      const matrix=matMul(perspective(1.05,rw/rh,.12,100),lookAt(eye,target));
      if(gl.isTestRenderer){gl.player=state.player;const a=this.drawBatch(this.staticData,matrix,gl.STATIC_DRAW);const b=this.drawBatch(new Float32Array([0,.2,0,0,1,0,.4,.8,1,1,.2,0,0,1,0,.4,.8,1,0,.8,0,0,1,0,.4,.8,1]),matrix,gl.DYNAMIC_DRAW);this.vertices=a+b;this.frames++;return;}
      const dynamic=[];for(const o of (state.objectives||[]))this.addRelay(dynamic,o,t);for(const n of (state.nodes||[])){if(!n.active)continue;const q=this.xy(n.x,n.y,.24),color=n.type==='fruit'?'#f6a54e':n.type==='scrap'?'#b7c4bb':'#8d8bff',pulse=1+Math.sin(t*4+n.x)*.1;this.cylinder(dynamic,q[0],.25,q[2],.37*pulse,.09,'#496e58',10);this.sphere(dynamic,q[0],.67,q[2],.26*pulse,color,0,8,5);this.sphere(dynamic,q[0]-.13,.79,q[2]+.12,.08,'#fff2c4',0,6,4);}for(const [product,px,py,color] of [['fruit',398,242,'#f0a54b'],['nectar',562,242,'#8fd8c0'],['cell',480,185,'#96bfe1']]){const q=this.xy(px,py,.32),count=Math.min(8,state.market?.shelves?.[product]||0);for(let j=0;j<count;j++){const col=j%4,row=Math.floor(j/4);this.sphere(dynamic,q[0]-.48+col*.32,.93+row*.18,q[2]+.04,.105,color,0,7,4);}}for(const person of (state.people||[]))this.addKeeper(dynamic,person,t);for(const shopper of (state.customers||[]))this.addShopper(dynamic,shopper,t);if(state.helper)this.addShopper(dynamic,{x:610,y:247,color:'#79d4ac'},t);for(const q of (state.particles||[])){const p=this.xy(q.x,q.y,.2);this.sphere(dynamic,p[0],.56+Math.sin(t*4+q.x)*.15,p[2],.07+(1-q.t)*.05,q.c||'#b8f2d3',0,6,4);}this.addExplorer(dynamic,state,t);
      const idx=state.objectives.findIndex(o=>!o.done);if(idx>=0){const goal=state.objectives[idx],g=this.xy(goal.x,goal.y,.2);this.cylinder(dynamic,g[0],.15,g[2],.9+Math.sin(t*3)*.07,.035,colors[idx],16);this.sphere(dynamic,g[0],2.45,g[2],.10,colors[idx],0,8,5);}
      for(const q of state.particles.slice(0,24)){const qx=this.xy(q.x,q.y,.2);this.sphere(dynamic,qx[0],.7+q.t*.45,qx[2],.055,q.c||'#bd8cff',0,6,4);}
      const a=this.drawBatch(this.staticData,matrix,gl.STATIC_DRAW),b=this.drawBatch(new Float32Array(dynamic),matrix,gl.DYNAMIC_DRAW);this.vertices=a+b;this.frames++;
    }
    diagnostics() { return {renderer:'WebGL 1 · procedural 3D',vertices:this.vertices,frames:this.frames,orbitDegrees:Math.round(this.targetYaw*180/Math.PI),zoom:this.targetZoom,spheres:this.spheres}; }
  }
  window.SecretShiftScene3D=Scene3D;
})();
