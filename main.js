var keiryoka=true;
var juliaValue=new quaternion(-0.5,0.3,-0.1,0.1);
const size=0.5;//5のとき1,10のとき0.5
const N=100;
var m=[0,0,0,0];
var obj=[];
var inst=[];
var vertex=[];
function generateVertex(){
    const s=size;
    vertex=[
        0,0,0,0,
        s,0,0,0,
        0,s,0,0,
        s,s,0,0,
        0,0,s,0,
        s,0,s,0,
        0,s,s,0,
        s,s,s,0,

        0,0,0,s,
        s,0,0,s,
        0,s,0,s,
        s,s,0,s,
        0,0,s,s,
        s,0,s,s,
        0,s,s,s,
        s,s,s,s
    ];
}
function generateInstance(){
inst=[];
    for(const o of obj){
        inst.push(o.position[0]);
        inst.push(o.position[1]);
        inst.push(o.position[2]);
        inst.push(o.position[3]+camera.position[3]);
        inst.push(o.color[0]);
        inst.push(o.color[1]);
        inst.push(o.color[2]);
        inst.push(1);
    }
};
//超ボクセルを描く手順
function generateIndex(obj){
    return [
        0,1,2,1,2,3,
        4,5,6,5,6,7,
        4,0,5,0,5,1,
        2,6,3,6,3,7,
        1,5,3,5,3,7,
        0,4,2,4,2,6,
        //平行
        8,9,10,9,10,11,
        12,13,14,13,14,15,
        12,8,13,8,13,9,
        10,14,11,14,11,15,
        9,13,11,13,11,15,
        8,12,10,12,10,14,
        //交差
        0,1,8,1,8,9,
        2,3,10,3,10,11,
        1,3,9,3,9,11,
        0,2,8,2,8,10,

        4,5,12,5,12,13,
        6,7,14,7,14,15,
        5,7,13,7,13,15,
        4,6,12,6,12,14,

        0,4,8,4,8,12,
        1,5,9,5,9,13,
        2,6,10,6,10,14,
        3,7,11,7,11,15
    ];
}
const camera={
    position:[0,0,25,0],
    velocity:10
}
const angle={
    xy:0,
    xz:0,
    yz:0,
    zw:0,
    xw:0,
    yw:0,
}
function createBuffer(M){
  var m=[];
for(let i=0; i<M.length; ++i){
  for(let j=0; j<M[i].length; ++j){
    m.push(M[j][i]);
  }
}
return new Float32Array(m);
}
const canvas=document.querySelector(".canvas");
async function main(){
// webgpuコンテキストの取得
const context = canvas.getContext('webgpu');

// deviceの取得
const g_adapter = await navigator.gpu.requestAdapter();
const g_device = await g_adapter.requestDevice();

//デバイスを割り当て
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device: g_device,
  format: presentationFormat,
  alphaMode: 'opaque'
});

//深度テクスチャ
var depthTexture;
if (!depthTexture ||
        depthTexture.width !== canvas.width ||
        depthTexture.height !== canvas.height){
      if (depthTexture) {
        depthTexture.destroy();
      }
      depthTexture =g_device.createTexture({
    size: [canvas.width,canvas.width],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
});
}
const vertWGSL=`
struct Uniforms {
  projectionMatrix : mat4x4<f32>,
  rotationMatrix:mat4x4<f32>,
  rotationWMatrix:mat4x4<f32>,
  translateMatrix:mat4x4<f32>
}
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragColor : vec4<f32>,
}
@vertex
fn main(@location(0) position: vec4<f32>,@location(1) color: vec4<f32>,@location(2) pos: vec4<f32>) -> VertexOutput {
  var output : VertexOutput;
  var v=uniforms.rotationWMatrix*(position+pos);
  //３次元への投影
  let dist:f32=20;
  v.y=v.y*dist/(dist-v.w);
  v.x=v.x*dist/(dist-v.w);
  v.z=v.z*dist/(dist-v.w);
  v.w=1;
  if(dist-v.w>0.5){
  output.Position = uniforms.projectionMatrix*uniforms.translateMatrix*uniforms.rotationMatrix*v;
  output.fragColor = color;
  }
  return output;
}
`;
const fragWGSL=`
@fragment
fn main(@location(0) fragColor: vec4<f32>) -> @location(0) vec4<f32> {
  return fragColor;
}
`;

generateVertex();

function render(){
generateInstance();
//頂点配列
const quadVertexArray = new Float32Array(vertex);
// 頂点データを作成.
const verticesBuffer = g_device.createBuffer({
  size: quadVertexArray.byteLength,
  usage: GPUBufferUsage.VERTEX,
  mappedAtCreation: true,
});
new Float32Array(verticesBuffer.getMappedRange()).set(quadVertexArray);
verticesBuffer.unmap();

//インデックス配列
const quadIndexArray = new Uint16Array(generateIndex());
const indicesBuffer = g_device.createBuffer({
  size: quadIndexArray.byteLength,
  usage: GPUBufferUsage.INDEX,
  mappedAtCreation: true,
});
//マップしたバッファデータをセット
new Uint16Array(indicesBuffer.getMappedRange()).set(quadIndexArray);
indicesBuffer.unmap();

//Uniformバッファ
const uniformBufferSize = 4*16*4;
  const uniformBuffer = g_device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
var bufferPosition=0;
//透視投影変換行列を与える。
const p=createBuffer(mat4.perspectiveMatrix(4*Math.PI/5,1,100,1));
g_device.queue.writeBuffer(
  uniformBuffer,
  //バッファのバイト位置
  bufferPosition,
  //データ
  p.buffer,
  //データの位置
  p.byteOffset,
  //大きさ
  p.byteLength
);
bufferPosition+=p.byteLength;

//回転行列を与える。
const R=createBuffer(mat.prod(mat.rotationMatrix(4,[3,4],angle.xy),mat.prod(mat.rotationMatrix(4,[1,4],angle.yz),mat.rotationMatrix(4,[2,4],angle.xz))));
g_device.queue.writeBuffer(
  uniformBuffer,
  //バッファのバイト位置
  bufferPosition,
  //データ
  R.buffer,
  //データの位置
  R.byteOffset,
  //大きさ
  R.byteLength
);
bufferPosition+=R.byteLength;
//4次元の回転行列
const Rw=createBuffer(mat.prod(mat.rotationMatrix(4,[1,2],angle.zw),mat.prod(mat.rotationMatrix(4,[1,3],angle.yw),mat.rotationMatrix(4,[2,3],angle.xw))));
g_device.queue.writeBuffer(
  uniformBuffer,
  //バッファのバイト位置
  bufferPosition,
  //データ
  Rw.buffer,
  //データの位置
  Rw.byteOffset,
  //大きさ
  Rw.byteLength
);
bufferPosition+=Rw.byteLength;
//平行移動を与える。
const ct=createBuffer(mat4.translate(new vector(camera.position[0],camera.position[1],camera.position[2])));
g_device.queue.writeBuffer(
  uniformBuffer,
  //バッファのバイト位置
  bufferPosition,
  //データ
  ct.buffer,
  //データの位置
  ct.byteOffset,
  //大きさ
  ct.byteLength
);
bufferPosition+=ct.byteLength;

//レンダーパイプラインの設定
const pipeline = g_device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    //頂点シェーダーのWGSLをここに。
    module: g_device.createShaderModule({
      code: vertWGSL,
    }),
    entryPoint: 'main',
    buffers: [
      {
        arrayStride: 4*4,
        attributes: [
          {
            shaderLocation: 0, // @location(0)
            offset: 0,
            format: 'float32x4',
          }
        ],
      },
        {//インスタンス
       	  arrayStride: 4 * 8,//4byte*dim4
          
          // バッファをインスタンスごとに参照することを意味します。
          stepMode: 'instance',
          
          attributes: [
            {
              //color
			  shaderLocation: 1,
              offset: 4*4,
              format: 'float32x4'//dim=4
            },
            {
			  shaderLocation: 2,
              offset: 0,
              format: 'float32x4'//dim=4
            }
          ]
        }
    ],
  },
  fragment: {
    //フラグメントシェーダーのWGSLをここに。
    module: g_device.createShaderModule({
      code: fragWGSL,
    }),
    entryPoint: 'main',
    //レンダー先(canvas)のフォーマットを指定
    targets: [
      { // @location(0) in fragment shader
        format: presentationFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
  },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
});

//インスタンスバッファを作成
const instancePositions=new Float32Array(inst);
  const instancesBuffer = g_device.createBuffer({
    size: instancePositions.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(instancesBuffer.getMappedRange()).set(instancePositions);
  instancesBuffer.unmap();

//バインドグループを作成
const bindGroup = g_device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0, // @binding(0) in shader
      resource: {
        buffer: uniformBuffer,
      },
    },
  ],
});
//コマンドバッファの作成
const commandEncoder = g_device.createCommandEncoder();
//レンダーパスの設定
const textureView = context.getCurrentTexture().createView();
  const renderPassDescriptor/*: GPURenderPassDescriptor */= {
    colorAttachments: [
      {
        view: textureView,
        //画面clearの色
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
        //まずclearする。
        loadOp: 'clear',
        //命令が終われば、状態を保持
        storeOp: 'store',
      },
    ],
      //深度テスター
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };
  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  //GPUに命令を設定

  //レンダーパイプラインを与える
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.setVertexBuffer(0, verticesBuffer);
  passEncoder.setIndexBuffer(indicesBuffer, 'uint16');
  passEncoder.setVertexBuffer(1, instancesBuffer);
  passEncoder.drawIndexed(quadIndexArray.length,Math.floor(instancePositions.length/8));
  // レンダーパスコマンドシーケンスの記録を完了する。
  passEncoder.end();
  //命令を発行
  g_device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(render);
    translate();
}
    render();
}
//簡単...?
main();
var key="";
canvas.addEventListener("contextmenu",()=>{
    event.preventDefault();
});
window.addEventListener("keydown",e=>{
    key=e.code;
    const mv=1;
    if(key=="ArrowRight"){
        m[0]-=mv;
    }
    if(key=="ArrowLeft"){
        m[0]+=mv;
    }
    if(key=="ArrowUp"){
        m[1]-=mv;
    }
    if(key=="ArrowDown"){
        m[1]+=mv;
    }
    if(key=="KeyF"){
        m[2]-=mv;
    }
    if(key=="KeyH"){
        m[2]+=mv;
    }
    if(key=="KeyT"){
        m[3]-=mv;
    }
    if(key=="KeyG"){
        m[3]+=mv;
    }
});
window.addEventListener("keyup",e=>{
    key="";
});
//描画毎に行う処理
function translate(){
    const cv=camera.velocity/60;
    if(key=="KeyW"){
        camera.position[2]-=cv;
    }
    if(key=="KeyA"){
        camera.position[0]-=cv;
    }
    if(key=="KeyS"){
        camera.position[2]+=cv;
    }
    if(key=="KeyD"){
        camera.position[0]+=cv;
    }
    if(key=="KeyE"){
        camera.position[3]+=cv;
    }
    if(key=="KeyQ"){
        camera.position[3]-=cv;
    }
    if(key=="Space"){
        camera.position[1]+=cv;
    }
    if(key=="ShiftLeft"){
        camera.position[1]-=cv;
    }
    if(key=="KeyI"){
        angle.xy+=0.1;
    }
    if(key=="KeyO"){
        angle.xz+=0.1;
    }
    if(key=="KeyP"){
        angle.yz+=0.1;
    }
    if(key=="KeyJ"){
        angle.zw+=0.1;
    }
    if(key=="KeyK"){
        angle.xw+=0.1;
    }
    if(key=="KeyL"){
        angle.yw+=0.1;
    }
    /*angle.xz+=0.01;
    angle.xy+=0.01;
    angle.yz+=0.01;
    angle.xw+=0.01;
    angle.yw+=0.01;
    angle.zw+=0.01;*/
}
function deleteObj(seed){
    let id=obj.findIndex(e=>e.seed==seed);
    if(seed!=-1){
    let res=obj.slice(0,id);
    let A=obj.slice(id+1,obj.length);
        for(let k=0; k<A.length; ++k){
            res.push(A[k]);
        }
        obj=res;
    }
}
//regenerateObj();
function createCube(x,y,z,w,color){
  if(!color){
    color=[Math.random(),Math.random(),Math.random()];
  }
    obj.push({position:[x,y,z,w],seed:Math.random(),color:color});
}
canvas.addEventListener("mousedown",e=>{
  if(key=="KeyE"){
    const id=find(m);
    if(e.button==2){
        if(id!=-1){
            console.log(id);
            deleteObj(obj[id].seed);
        }
    }else{
        if(id==-1){
    createCube(m[0],m[1],m[2],m[3]);
        }
    }
  }
});
function find(v){
    return obj.findIndex(e=>e.position.join()==v.join());
}
createCube(1000,1000,1000,1000)

function mengerSponge2D(center,ite){
    if(ite==0){
        createCube(center[0],center[1],0,0)
    }else{
    for(let i=0; i<=2; ++i){
        for(let j=0; j<=2; ++j){
            const d=Math.pow(3,ite-1)*size;
            if(!(i==1 && j==1)){
                mengerSponge2D([center[0]+i*d,center[1]+j*d],ite-1);
            }
        }
    }
}
}
function mengerSponge3D(center,ite){
    if(ite==0){
        createCube(center[0],center[1],center[2],0);
    }else{
    for(let i=0; i<=2; ++i){
        for(let j=0; j<=2; ++j){
            for(let k=0; k<=2; ++k){
            const d=Math.pow(3,ite-1)*size;
            if(!(i==1 && j==1) && !(j==1 && k==1) && !(i==1 && k==1)){
                mengerSponge3D([center[0]+i*d,center[1]+j*d,center[2]+k*d],ite-1);
            }
        }
        }
    }
}
}
function mengerSponge4D(center,ite,color){
  if(!color){
    color=[Math.random(),Math.random(),Math.random()];
    color=vec.prod(color,1/vec.length(color));
  }
  if(ite==2){
    var n=[Math.random(),Math.random(),Math.random()];
    color=vec.prod(n,vec.length(color));
  }
    if(ite==0){
        createCube(center[0],center[1],center[2],center[3],color);
    }else{
    for(let i=0; i<=2; ++i){
        for(let j=0; j<=2; ++j){
            for(let k=0; k<=2; ++k){
                for(let l=0; l<=2; ++l){
            const d=Math.pow(3,ite-1)*size;
            if(!(i==1 && j==1) && !(j==1 && k==1) && !(i==1 && k==1) && !(i==1 && l==1) && !(j==1 && l==1) && !(k==1 && l==1)){
                mengerSponge4D([center[0]+i*d,center[1]+j*d,center[2]+k*d,center[3]+l*d],ite-1,vec.prod(color,(4+i+j+k+l)/((i+2)/3*(4+i+j+k+l)+l)));
            }
        }
    }
        }
    }
}
}
var mon=0;
canvas.addEventListener("mousedown",e=>{
    if(e.button!=0){
        if(e.button==2){
        mon=2;
        }
        if(e.button==4){
        mon=3;
        }
    }else{
    mon=1;
    }
});
canvas.addEventListener("mouseup",e=>{
    mon=0;
});
window.addEventListener("mousemove",e=>{
    const v=new vector(camera.velocity*e.movementX/2000,camera.velocity*e.movementY/2000);
    if(mon==1 || key=="KeyE"){
        angle.xz-=v.x;
        if((v.y>0 && angle.yz<Math.PI/2) || (v.y<=0 && angle.yz>=-Math.PI/2)){
        angle.yz+=v.y;
        }
    }
    if(mon==3 || key=="KeyR"){
        angle.xy-=v.x;
        angle.zw+=v.y;
    }
    if(mon==2 || key=="KeyQ"){
        angle.xw+=v.x;
        angle.yw-=v.y;
    }
});
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
    if(mon==3){
    camera.position[3]-=camera.velocity*e.deltaY/700;
    }else{
    camera.position[2]+=camera.velocity*e.deltaY/700;
    }
});
const n=3;
mengerSponge4D([-size*(3**n)/2,-size*(3**n)/2,-size*(3**n)/2,-size*(3**n)/2],n);