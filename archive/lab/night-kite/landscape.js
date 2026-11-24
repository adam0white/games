// Static ink layers. The village is rendered once at print resolution.
import { ROOF } from './sim.js';

const inks = {
  indigo: ['#946e78','#735b70','#544c68','#49465d','#32364c','#252d40','#b78b86','#edc58f','#736876'],
  copper: ['#b78475','#925f65','#74505c','#604c54','#493e4c','#382f3d','#ca9781','#f5cc8a','#926c68']
};
const cache = new Map();

function shape(c, color, vertices) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...vertices[0]);
  for (let i = 1; i < vertices.length; i++) c.lineTo(...vertices[i]);
  c.closePath();
  c.fill();
}
function mark(c, color, width, vertices) {
  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.moveTo(...vertices[0]);
  for (let i = 1; i < vertices.length; i++) c.lineTo(...vertices[i]);
  c.stroke();
}
function tree(c, x, y, h, color) {
  shape(c, color, [[x-1,y],[x-1,y-h*.26],[x-h*.15,y-h*.3],[x-h*.1,y-h*.65],
    [x-h*.035,y-h*.9],[x+.4,y-h],[x+h*.08,y-h*.68],[x+h*.14,y-h*.32],[x+2,y-h*.24],[x+1,y]]);
}

// Ridge, pitch and frontage differ for each cottage. The last three values
// set the ridge's offset, chimney side and the number of lit windows.
const cottages = [
  [-13,352,41,14,.57,0,1], [17,357,24,15,.42,1,1], [45,367,37,12,.42,0,2],
  [75,362,27,21,.6,1,1], [96,371,45,15,.49,1,3], [142,373,30,15,.65,0,2],
  [197,370,32,21,.4,0,1], [221,359,42,15,.56,1,2], [259,355,30,18,.43,0,2],
  [292,349,39,14,.62,1,1], [325,340,33,20,.41,0,2], [350,344,31,13,.49,1,2]
];

function cottage(c, colors, [x, y, w, h, ridge, chimneySide, lights]) {
  const [, , ,wall,shade,roof,trim,lit] = colors;
  const apex = x + w * ridge;
  const eave = y + 4;
  shape(c, wall, [[x,eave],[apex,y-h],[x+w,eave],[x+w,408],[x,408]]);
  shape(c, shade, [[apex+3,y-h+6],[x+w,eave],[x+w,408],[apex+3,408]]);
  const chimney = x + w * (chimneySide ? .73 : .26);
  c.fillStyle = roof; c.fillRect(chimney, y-h+1, 4, 11); c.fillRect(chimney-.6,y-h,5.3,2);
  shape(c, roof, [[x-3,eave+1],[apex,y-h-2],[x+w+3,eave-1],[x+w+1,eave+3],[apex,y-h+2],[x-1,eave+4]]);
  mark(c,trim,.65,[[x+1,eave-1],[apex,y-h-2],[apex+4,y-h]]);
  for (let i=0; i<lights; i++) {
    const xx = x+5+i*(w-8)/lights, yy = y+8+(i%2)*2;
    c.fillStyle=roof; c.fillRect(xx-1,yy-1,5.5,8);
    c.fillStyle=lit; c.fillRect(xx,yy,3.4,5.8);
    c.fillStyle=shade; c.fillRect(xx+1.6,yy,.6,5.8); c.fillRect(xx,yy+2.5,3.4,.6);
  }
}
function drawPlate(c, colors, tall) {
  const [far,middle,near,wall,shade,ink,trim,lit,meadow] = colors;
  shape(c,far,[[0,326],[23,321],[49,325],[77,318],[104,315],[131,321],[159,311],[183,302],
    [200,308],[219,303],[247,312],[271,307],[304,294],[323,289],[345,300],[360,293],[360,520],[0,520]]);
  shape(c,middle,[[0,320],[26,314],[52,321],[75,329],[102,328],[127,336],[155,331],
    [193,338],[221,327],[246,324],[267,314],[292,309],[322,317],[344,309],[360,312],[360,520],[0,520]]);
  // Small slivers of evening light follow the contour of the hillside.
  for (const [x,y,w] of [[6,328,17],[36,331,28],[248,326,21],[280,318,28],[303,323,32],[73,340,22]]) {
    mark(c,trim,.65,[[x,y],[x+w*.4,y-1.5],[x+w,y-1]]);
  }
  shape(c,near,[[0,346],[19,342],[44,346],[78,349],[110,354],[146,349],[170,351],
    [201,348],[229,345],[243,337],[263,339],[283,333],[309,334],[338,325],[360,330],[360,520],[0,520]]);
  for (const [x,y,h] of [[10,350,15],[33,351,22],[38,351,13],[69,354,18],[125,360,16],
    [151,355,24],[156,355,19],[212,349,14],[284,342,22],[288,340,12],[323,336,14]]) tree(c,x,y,h,shade);
  for (const house of cottages) cottage(c, colors, house);

  const base = tall ? ROOF.y : 330;
  c.save(); c.translate(ROOF.x,base);
  shape(c,wall,[[-12,18],[0,1],[14,18],[14,105],[-12,105]]);
  shape(c,shade,[[2,12],[14,18],[14,105],[2,105]]);
  shape(c,ink,[[-16,22],[-4,9],[0,-2],[4,8],[18,22],[14,24],[0,8],[-13,24]]);
  mark(c,trim,.9,[[-14,20],[-3,8],[0,-1]]);
  c.fillStyle=ink; c.fillRect(-2,-6,2,6);
  for(const x of [-7,4]) {
    c.fillStyle=ink; c.fillRect(x-1,25,6,13);
    c.fillStyle=lit; c.fillRect(x,27,3.6,8); c.fillStyle=shade; c.fillRect(x+1.6,27,.6,8);
  }
  mark(c,trim,1,[[-11,40],[1,41],[14,39]]);
  c.restore();

  shape(c,shade,[[0,373],[36,378],[70,383],[113,381],[154,374],[178,377],[210,380],
    [253,374],[291,367],[333,365],[360,360],[360,520],[0,520]]);
  // Meadow paths turn toward the village.
  shape(c,meadow,[[74,415],[100,397],[116,393],[119,390],[109,388],[119,383],
    [134,380],[122,384],[117,387],[131,389],[127,393],[111,396],[94,411]]);
  shape(c,ink,[[0,389],[41,394],[78,404],[116,408],[156,406],[195,403],[245,394],
    [287,393],[326,385],[360,380],[360,520],[0,520]]);
  for(const [x,y,h] of [[-3,391,52],[5,393,39],[12,394,25],[310,390,23],[315,390,34],
    [322,387,18],[345,383,31],[352,383,42]]) tree(c,x,y,h,ink);
  c.globalAlpha=.35;
  for(let row=0;row<6;row++) {
    const y=408+row*14;
    for(let i=0;i<10;i++){
      const x=(i*49+row*31)%368-8;
      mark(c,meadow,.65,[[x,y],[x+5,y-1],[x+9,y-.8]]);
    }
  }
  c.globalAlpha=1;
}
export function landscape(c, look, lantern) {
  const key = look + (lantern ? '-tower' : '');
  if (!cache.has(key)) {
    const layer = document.createElement('canvas');
    layer.width = 720;
    layer.height = 1040;
    const g = layer.getContext('2d');
    g.scale(2,2);
    g.lineCap='round'; g.lineJoin='round';
    drawPlate(g, inks[look] || inks.indigo, lantern);
    cache.set(key, layer);
  }
  c.drawImage(cache.get(key),0,0,360,520);
}
