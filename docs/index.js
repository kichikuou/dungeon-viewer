// src/index.ts
import * as THREE2 from "https://unpkg.com/three@0.126.1/build/three.module.js";
import {OrbitControls as OrbitControls2} from "https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js";

// src/buffer.ts
function readFileAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(reader.error);
    };
    reader.readAsArrayBuffer(blob);
  });
}

class BufferReader {
  view;
  offset = 0;
  constructor(buf) {
    this.view = new DataView(buf);
  }
  get buffer() {
    return this.view.buffer;
  }
  readU32() {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }
  readS32() {
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }
  readF32() {
    const val = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }
  readFourCC() {
    const fourcc = new Uint8Array(this.view.buffer, this.offset, 4);
    this.offset += 4;
    return String.fromCharCode.apply(null, Array.from(fourcc));
  }
  readBytes(len) {
    const bytes = new Uint8Array(this.view.buffer, this.offset, len);
    this.offset += len;
    return bytes;
  }
  readStrZ() {
    const begin = this.offset;
    while (this.view.getUint8(this.offset) !== 0) {
      this.offset++;
    }
    this.offset++;
    return new Uint8Array(this.view.buffer, begin, this.offset - 1 - begin);
  }
  expectU32(expected) {
    const val = this.readU32();
    if (val !== expected) {
      throw new Error(`Expected ${expected} but got ${val} at offset ${this.offset - 4}`);
    }
    return val;
  }
}

// src/dtex.ts
var TextureType;
(function(TextureType2) {
  TextureType2[TextureType2["Wall"] = 0] = "Wall";
  TextureType2[TextureType2["Floor"] = 1] = "Floor";
  TextureType2[TextureType2["Ceiling"] = 2] = "Ceiling";
  TextureType2[TextureType2["Stairs"] = 3] = "Stairs";
  TextureType2[TextureType2["Door"] = 4] = "Door";
  TextureType2[TextureType2["SkyBox"] = 5] = "SkyBox";
})(TextureType || (TextureType = {}));

class Dtex {
  data = [];
  nr_rows;
  nr_cols;
  constructor(buf) {
    const r = new BufferReader(buf);
    if (r.readFourCC() !== "DTEX") {
      throw new Error("not a DTEX");
    }
    const version = r.readU32();
    if (version !== 0 && version !== 1) {
      throw new Error("unknown DTEX version");
    }
    this.nr_rows = r.readU32();
    this.nr_cols = r.readU32();
    for (let row = 0;row < this.nr_rows; row++) {
      this.data[row] = [];
      const nr_items = r.readU32();
      if (nr_items !== this.nr_cols) {
        throw new Error("unexpected number of textures");
      }
      for (let col = 0;col < this.nr_cols; col++) {
        const size = r.readU32();
        if (size !== 0) {
          this.data[row][col] = r.readBytes(size);
        }
      }
    }
  }
  get(row, col) {
    return this.data[row][col];
  }
}

// src/dugn.ts
class Dugn {
  version;
  sizeX;
  sizeY;
  sizeZ;
  cells = [];
  pvs = null;
  footer = [];
  constructor(buf, fromDlf) {
    const r = new BufferReader(buf);
    if (r.readFourCC() !== "DUGN") {
      throw new Error("not a DUGN");
    }
    this.version = r.readU32();
    this.sizeX = r.readU32();
    this.sizeY = r.readU32();
    this.sizeZ = r.readU32();
    r.offset += 40;
    const nr_cells = this.sizeX * this.sizeY * this.sizeZ;
    for (let i = 0;i < nr_cells; i++) {
      this.cells.push(new Cell(this.version, fromDlf, r));
    }
    r.offset += 1;
    const has_pvs = r.readU32() != 0;
    if (has_pvs) {
      this.pvs = [];
      for (let i = 0;i < nr_cells; i++) {
        this.pvs.push(new PVS(this, r));
      }
    }
    this.footer.push(r.readF32());
    this.footer.push(r.readF32());
    this.footer.push(r.readF32());
    this.footer.push(r.readF32());
    this.footer.push(r.readF32());
    this.footer.push(r.readU32());
    if (this.version == 13) {
      this.footer.push(r.readF32());
      this.footer.push(r.readF32());
    }
    if (!fromDlf && (this.version === 10 || this.version === 11)) {
      this.footer.push(r.readU32());
      this.footer.push(r.readU32());
      this.footer.push(r.readU32());
    }
    if (r.offset !== r.buffer.byteLength) {
      throw new Error(`extra ${r.buffer.byteLength - r.offset} bytes of data at the end`);
    }
  }
  cellAt(x, y, z) {
    return this.cells[(z * this.sizeY + y) * this.sizeX + x];
  }
  pvsAt(x, y, z) {
    if (!this.pvs) {
      return null;
    }
    return this.pvs[(z * this.sizeY + y) * this.sizeX + x];
  }
}

class Cell {
  version;
  v;
  pairs = [];
  offsetAfterPairs;
  constructor(version, fromDlf, r) {
    this.version = version;
    const offset = r.offset;
    r.offset += 140;
    for (let i = 0;i < 6; i++) {
      const n = r.readU32();
      const s = r.readStrZ();
      this.pairs.push({ n, s });
    }
    this.offsetAfterPairs = r.offset - offset;
    switch (version) {
      case 8:
        break;
      case 10:
        r.offset += fromDlf ? 8 : 36;
        break;
      case 11:
        r.offset += 68;
        break;
      case 13:
        if (this.offsetAfterPairs !== 170) {
          throw new Error("unexpected non-empty string field in DUGN v13");
        }
        r.offset += 60;
        break;
      default:
        throw new Error("unknown DUGN version " + version);
    }
    this.v = new DataView(r.buffer, offset, r.offset - offset);
  }
  getAttr(n) {
    return this.v.getInt32(n * 4, true);
  }
  get floor_texture() {
    return this.getAttr(0);
  }
  get ceiling_texture() {
    return this.getAttr(1);
  }
  get north_texture() {
    return this.getAttr(2);
  }
  get south_texture() {
    return this.getAttr(3);
  }
  get east_texture() {
    return this.getAttr(4);
  }
  get west_texture() {
    return this.getAttr(5);
  }
  get north_door() {
    return this.getAttr(6);
  }
  get south_door() {
    return this.getAttr(7);
  }
  get east_door() {
    return this.getAttr(8);
  }
  get west_door() {
    return this.getAttr(9);
  }
  get stairs_texture() {
    return this.getAttr(10);
  }
  get stairs_orientation() {
    return this.getAttr(11);
  }
  get unknown1() {
    return this.v.getInt32(this.offsetAfterPairs, true);
  }
  get buttle_background() {
    return this.v.getInt32(this.offsetAfterPairs + 4, true);
  }
  get polyobj_index() {
    return this.version === 13 ? this.v.getInt32(178, true) : -1;
  }
  get polyobj_scale() {
    return this.version === 13 ? this.v.getFloat32(182, true) : 1;
  }
  get polyobj_rotationY() {
    return this.version === 13 ? this.v.getFloat32(186, true) : 0;
  }
  get polyobj_rotationZ() {
    return this.version === 13 ? this.v.getFloat32(190, true) : 0;
  }
  get polyobj_rotationX() {
    return this.version === 13 ? this.v.getFloat32(194, true) : 0;
  }
  get polyobj_positionX() {
    return this.version === 13 ? this.v.getFloat32(198, true) : 0;
  }
  get polyobj_positionY() {
    return this.version === 13 ? this.v.getFloat32(202, true) : 0;
  }
  get polyobj_positionZ() {
    return this.version === 13 ? this.v.getFloat32(206, true) : 0;
  }
  get roof_orientation() {
    return this.version === 13 ? this.v.getInt32(210, true) : -1;
  }
  get roof_texture() {
    return this.version === 13 ? this.v.getInt32(214, true) : -1;
  }
  get roof_underside_texture() {
    return this.version === 13 ? this.v.getInt32(222, true) : -1;
  }
}

class PVS {
  dgn;
  runLengths = [];
  constructor(dgn, r) {
    this.dgn = dgn;
    const len = r.readU32();
    if (len % 8 !== 4)
      throw new Error("unexpected PVS length");
    const end = r.offset + len;
    const nrCells = r.readU32();
    if (nrCells !== dgn.sizeX * dgn.sizeY * dgn.sizeZ)
      throw new Error("bad PVS");
    let total = 0;
    while (r.offset < end) {
      const invisibleCells = r.readU32();
      const visibleCells = r.readU32();
      this.runLengths.push([invisibleCells, visibleCells]);
      total += invisibleCells + visibleCells;
    }
    if (total !== nrCells)
      throw new Error("broken PVS");
  }
  getVisibleCells() {
    const cells = [];
    let i = 0, invisibleCells = 0, visibleCells = 0;
    for (let z = 0;z < this.dgn.sizeZ; z++) {
      for (let y = 0;y < this.dgn.sizeY; y++) {
        for (let x = 0;x < this.dgn.sizeX; x++) {
          if (invisibleCells === 0 && visibleCells === 0) {
            [invisibleCells, visibleCells] = this.runLengths[i++];
          }
          if (invisibleCells > 0) {
            invisibleCells--;
          } else {
            cells.push({ x, y, z });
            visibleCells--;
          }
        }
      }
    }
    return cells;
  }
}

// src/polyobj.ts
class PolyObj {
  textures = [];
  objects = [];
  constructor(buf) {
    const r = new BufferReader(buf);
    if (r.readFourCC() !== "POL\0") {
      throw new Error("not a POL file");
    }
    if (r.readU32() !== 0) {
      throw new Error("unknown POL version");
    }
    const nr_textures = r.readU32();
    for (let i = 0;i < nr_textures; i++) {
      const offset = r.readU32();
      const length = r.readU32();
      this.textures.push(new Uint8Array(buf, offset, length));
    }
    const nr_objects = r.readU32();
    for (let i = 0;i < nr_objects; i++) {
      const offset = r.readU32();
      const length = r.readU32();
      if (length > 0) {
        this.objects[i] = new Object(new BufferReader(buf.slice(offset, offset + length)));
      }
    }
  }
}

class Object {
  name;
  materials = [];
  parts = [];
  constructor(r) {
    this.name = r.readStrZ();
    if (r.readFourCC() !== "POO\0") {
      throw new Error("not a POO");
    }
    if (r.readU32() !== 0) {
      throw new Error("unknown POO version");
    }
    const nr_materials = r.readU32();
    for (let i = 0;i < nr_materials; i++) {
      this.materials.push(r.readU32());
    }
    const nr_parts = r.readU32();
    for (let i = 0;i < nr_parts; i++) {
      const nr_vertices = r.readU32();
      const vertices = [];
      for (let j = 0;j < nr_vertices; j++) {
        vertices.push({ x: r.readF32(), y: r.readF32(), z: r.readF32() });
      }
      const nr_triangles = r.readU32();
      const triangles = [];
      for (let j = 0;j < nr_triangles; j++) {
        triangles.push({
          material: r.readU32(),
          index: [r.readU32(), r.readU32(), r.readU32()],
          uv: [
            { u: r.readF32(), v: r.readF32() },
            { u: r.readF32(), v: r.readF32() },
            { u: r.readF32(), v: r.readF32() }
          ]
        });
      }
      this.parts.push({ vertices, triangles });
    }
  }
}

// src/dungeon_collection.ts
class DungeonCollection {
  dgn = [];
  dtx = [];
  tes = [];
  polyobj = null;
  fromDlf = false;
  async addFile(file) {
    if (file.name.toLowerCase() === "dungeondata.dlf") {
      const headerBuf = await readFileAsArrayBuffer(file.slice(0, 2408));
      const r = new BufferReader(headerBuf);
      if (r.readFourCC() !== "DLF\0") {
        throw new Error("not a dlf file");
      }
      r.offset = 8;
      for (let i = 0;i < 100; i++) {
        const dgnOffset = r.readU32();
        const dgnLength = r.readU32();
        const dtxOffset = r.readU32();
        const dtxLength = r.readU32();
        const tesOffset = r.readU32();
        const tesLength = r.readU32();
        if (dgnOffset)
          this.dgn[i] = file.slice(dgnOffset, dgnOffset + dgnLength);
        if (dtxOffset)
          this.dtx[i] = file.slice(dtxOffset, dtxOffset + dtxLength);
        if (tesOffset)
          this.tes[i] = file.slice(tesOffset, tesOffset + tesLength);
      }
      this.fromDlf = true;
      return;
    }
    const match = /^(field|map)(\d+)\.(dgn|dtx|mrk|tes)$/.exec(file.name.toLowerCase());
    if (match) {
      const i = Number(match[2]);
      switch (match[3]) {
        case "dgn":
          this.dgn[i] = file;
          break;
        case "dtx":
          this.dtx[i] = file;
          break;
        case "tes":
          this.tes[i] = file;
          break;
      }
      return;
    }
    if (file.name.toLowerCase() === "polyobj.lin") {
      this.polyobj = file;
      return;
    }
    console.log("unrecognized file: " + file.name);
  }
  getIds() {
    const ids = [];
    for (let i = 0;i < this.dgn.length; i++) {
      if (this.dgn[i] && this.dtx[i])
        ids.push(i);
    }
    return ids;
  }
  async getDugn(i) {
    return new Dugn(await readFileAsArrayBuffer(this.dgn[i]), this.fromDlf);
  }
  async getDtex(i) {
    return new Dtex(await readFileAsArrayBuffer(this.dtx[i]));
  }
  async getPolyObj() {
    if (!this.polyobj) {
      return null;
    }
    return new PolyObj(await readFileAsArrayBuffer(this.polyobj));
  }
}

// src/model.ts
import * as THREE from "https://unpkg.com/three@0.126.1/build/three.module.js";
var createStairsGeometry = function() {
  const vertices = [
    { pos: [-1, 1, -1], uv: [0, 1] },
    { pos: [1, 1, -1], uv: [1, 1] },
    { pos: [-1, 1, -0.6666666666666666], uv: [0, 0.9166666666666666] },
    { pos: [1, 1, -0.6666666666666666], uv: [1, 0.9166666666666666] },
    { pos: [-1, 0.6666666666666666, -0.6666666666666666], uv: [0, 0.8333333333333334] },
    { pos: [1, 0.6666666666666666, -0.6666666666666666], uv: [1, 0.8333333333333334] },
    { pos: [-1, 0.6666666666666666, -0.3333333333333333], uv: [0, 0.75] },
    { pos: [1, 0.6666666666666666, -0.3333333333333333], uv: [1, 0.75] },
    { pos: [-1, 0.3333333333333333, -0.3333333333333333], uv: [0, 0.6666666666666666] },
    { pos: [1, 0.3333333333333333, -0.3333333333333333], uv: [1, 0.6666666666666666] },
    { pos: [-1, 0.3333333333333333, 0], uv: [0, 0.5833333333333334] },
    { pos: [1, 0.3333333333333333, 0], uv: [1, 0.5833333333333334] },
    { pos: [-1, 0, 0], uv: [0, 0.5] },
    { pos: [1, 0, 0], uv: [1, 0.5] },
    { pos: [-1, 0, 0.3333333333333333], uv: [0, 0.4166666666666667] },
    { pos: [1, 0, 0.3333333333333333], uv: [1, 0.4166666666666667] },
    { pos: [-1, -0.3333333333333333, 0.3333333333333333], uv: [0, 0.3333333333333333] },
    { pos: [1, -0.3333333333333333, 0.3333333333333333], uv: [1, 0.3333333333333333] },
    { pos: [-1, -0.3333333333333333, 0.6666666666666666], uv: [0, 0.25] },
    { pos: [1, -0.3333333333333333, 0.6666666666666666], uv: [1, 0.25] },
    { pos: [-1, -0.6666666666666666, 0.6666666666666666], uv: [0, 0.16666666666666666] },
    { pos: [1, -0.6666666666666666, 0.6666666666666666], uv: [1, 0.16666666666666666] },
    { pos: [-1, -0.6666666666666666, 1], uv: [0, 0.08333333333333333] },
    { pos: [1, -0.6666666666666666, 1], uv: [1, 0.08333333333333333] },
    { pos: [-1, -1, 1], uv: [0, 0] },
    { pos: [1, -1, 1], uv: [1, 0] }
  ];
  const indices = [];
  for (let i = 0;i < 12; i++) {
    indices.push(i * 2 + 0, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const positions = new Float32Array(vertices.length * 3);
  const uvs = new Float32Array(vertices.length * 2);
  for (let i = 0;i < vertices.length; i++) {
    positions.set(vertices[i].pos, i * 3);
    uvs.set(vertices[i].uv, i * 2);
  }
  const geometry = new THREE.BufferGeometry;
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
};
var decodeImage = function(lib, buf) {
  const fmt = String.fromCharCode.apply(null, Array.from(buf.slice(0, 4)));
  if (fmt === "QNT\0") {
    return Promise.resolve(decodeQnt(lib, buf));
  } else if (fmt === "ROU\0") {
    return Promise.resolve(decodeRou(buf));
  } else if (fmt === "RIFF") {
    return decodeWebp(buf);
  } else {
    throw new Error("Unknown texture format " + fmt);
  }
};
var decodeQnt = function(lib, buf) {
  const ptr = lib.malloc(buf.byteLength);
  lib.memset(ptr, buf);
  const decoded = lib.qnt_extract(ptr);
  lib.free(ptr);
  if (decoded === 0)
    throw new Error("qnt_extract failed");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ofs = dv.getUint32(4, true) === 0 ? 0 : 4;
  const width = dv.getUint32(16 + ofs, true);
  const height = dv.getUint32(20 + ofs, true);
  const hasAlpha = dv.getUint32(36 + ofs, true) !== 0;
  const pixels = lib.memget(decoded, width * height * 4);
  lib.free(decoded);
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  return { texture, hasAlpha };
};
var decodeRou = function(buf) {
  const r = new BufferReader(buf.buffer);
  r.offset = buf.byteOffset;
  if (r.readFourCC() !== "ROU\0") {
    throw new Error("Not a ROU image");
  }
  r.expectU32(0);
  const hdrSize = r.readU32();
  if (hdrSize !== 68) {
    throw new Error("ROU: Unexpected header size " + hdrSize);
  }
  r.expectU32(0);
  r.expectU32(0);
  const width = r.readU32();
  const height = r.readU32();
  r.expectU32(24);
  r.expectU32(0);
  const pixels_size = r.expectU32(width * height * 3);
  const alpha_size = r.readU32();
  while (r.offset + buf.byteOffset < hdrSize) {
    r.expectU32(0);
  }
  if (buf.byteLength != hdrSize + pixels_size + alpha_size) {
    throw new Error(`ROU: Unexpected data length. ${buf.byteLength} != ${hdrSize} + ${pixels_size} + ${alpha_size}`);
  }
  if (alpha_size === 0) {
    const pixels = buf.subarray(hdrSize, hdrSize + pixels_size);
    const texture2 = new THREE.DataTexture(pixels, width, height, THREE.RGBFormat, THREE.UnsignedByteType);
    return { texture: texture2, hasAlpha: false };
  }
  if (alpha_size !== width * height) {
    throw new Error(`ROU: Unexpected alpha_size. ${alpha_size} != ${width} * ${height}`);
  }
  let rgb = hdrSize;
  let alpha = hdrSize + pixels_size;
  const rgba_buf = new Uint8Array(width * height * 4);
  let rgba = 0;
  while (rgba < width * height * 4) {
    rgba_buf[rgba++] = buf[rgb++];
    rgba_buf[rgba++] = buf[rgb++];
    rgba_buf[rgba++] = buf[rgb++];
    rgba_buf[rgba++] = buf[alpha++];
  }
  const texture = new THREE.DataTexture(rgba_buf, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  return { texture, hasAlpha: true };
};
async function decodeWebp(buf) {
  const decoder = new ImageDecoder({ data: buf, type: "image/webp" });
  const image = (await decoder.decode()).image;
  const pixels = new Uint8Array(image.allocationSize());
  await image.copyTo(pixels);
  const hasAlpha = image.format[3] == "A";
  if (image.format === "BGRX" || image.format === "BGRA") {
    for (let i = 0;i < pixels.length; i += 4) {
      const tmp = pixels[i];
      pixels[i] = pixels[i + 2];
      pixels[i + 2] = tmp;
    }
  }
  const texture = new THREE.DataTexture(pixels, image.codedWidth, image.codedHeight, THREE.RGBAFormat, THREE.UnsignedByteType);
  return { texture, hasAlpha };
}
var planeGeometry = new THREE.PlaneGeometry(2, 2);
var stairsGeometry = createStairsGeometry();

class DungeonModel extends THREE.Group {
  dgn;
  materials;
  sizeX;
  sizeY;
  sizeZ;
  set onTextureLoad(handler) {
    this.materials.onTextureLoad = handler;
  }
  constructor(dgn, dtx, polyFactory, lib) {
    super();
    this.dgn = dgn;
    this.sizeX = dgn.sizeX;
    this.sizeY = dgn.sizeY;
    this.sizeZ = dgn.sizeZ;
    this.materials = new MaterialCache(dtx, lib);
    for (let z = 0;z < dgn.sizeZ; z++) {
      for (let y = 0;y < dgn.sizeY; y++) {
        for (let x = 0;x < dgn.sizeX; x++) {
          const cell = dgn.cellAt(x, y, z);
          this.add(new CellModel(x, y, z, cell, this.materials, polyFactory));
        }
      }
    }
  }
  dispose() {
    this.materials.dispose();
  }
}

class CellModel extends THREE.Group {
  x;
  y;
  z;
  cell;
  constructor(x, y, z, cell, materials, polyFactory) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
    this.cell = cell;
    const [wx, wy, wz] = [x * 2, y * 2, -z * 2];
    if (cell.floor_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Floor, cell.floor_texture));
      plane.rotation.x = Math.PI / -2;
      plane.position.set(wx, wy - 1, wz);
    }
    if (cell.ceiling_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Ceiling, cell.ceiling_texture));
      plane.rotation.x = Math.PI / 2;
      plane.rotation.z = Math.PI;
      plane.position.set(wx, wy + 1, wz);
    }
    if (cell.north_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Wall, cell.north_texture));
      plane.position.set(wx, wy, wz - 1);
    }
    if (cell.south_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Wall, cell.south_texture));
      plane.rotation.y = Math.PI;
      plane.position.set(wx, wy, wz + 1);
    }
    if (cell.east_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Wall, cell.east_texture));
      plane.rotation.y = Math.PI / -2;
      plane.position.set(wx + 1, wy, wz);
    }
    if (cell.west_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Wall, cell.west_texture));
      plane.rotation.y = Math.PI / 2;
      plane.position.set(wx - 1, wy, wz);
    }
    if (cell.north_door >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Door, cell.north_door));
      plane.position.set(wx, wy, wz - 1);
    }
    if (cell.south_door >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Door, cell.south_door));
      plane.rotation.y = Math.PI;
      plane.position.set(wx, wy, wz + 1);
    }
    if (cell.east_door >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Door, cell.east_door));
      plane.rotation.y = Math.PI / -2;
      plane.position.set(wx + 1, wy, wz);
    }
    if (cell.west_door >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Door, cell.west_door));
      plane.rotation.y = Math.PI / 2;
      plane.position.set(wx - 1, wy, wz);
    }
    if (cell.stairs_texture >= 0) {
      const stairs = this.addStairs(materials.get(TextureType.Stairs, cell.stairs_texture));
      stairs.position.set(wx, wy, wz);
      stairs.rotation.y = Math.PI / 2 * cell.stairs_orientation;
    }
    if (polyFactory && cell.polyobj_index >= 0) {
      const obj = polyFactory.createModel(cell.polyobj_index);
      obj.scale.set(cell.polyobj_scale, cell.polyobj_scale, cell.polyobj_scale);
      obj.rotation.y = cell.polyobj_rotationY * Math.PI / -180;
      const posX = wx + cell.polyobj_positionX;
      const posY = wy - 1 + cell.polyobj_positionY;
      const posZ = wz - cell.polyobj_positionZ;
      obj.position.set(posX, posY, posZ);
      this.add(obj);
    }
    if (cell.roof_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Stairs, cell.roof_texture));
      plane.scale.y = Math.sqrt(2);
      plane.position.set(wx, wy, wz);
      plane.rotation.y = Math.PI / 2 * cell.roof_orientation;
      plane.rotation.x = Math.PI / -4;
      plane.rotation.order = "ZYX";
    }
    if (cell.roof_underside_texture >= 0) {
      const plane = this.addPlane(materials.get(TextureType.Stairs, cell.roof_underside_texture));
      plane.scale.y = Math.sqrt(2);
      plane.position.set(wx, wy, wz);
      plane.rotation.y = Math.PI + Math.PI / 2 * cell.roof_orientation;
      plane.rotation.x = Math.PI / 4;
      plane.rotation.order = "ZYX";
    }
  }
  addPlane(material) {
    const plane = new THREE.Mesh(planeGeometry, material);
    this.add(plane);
    return plane;
  }
  addStairs(material) {
    const stairs = new THREE.Mesh(stairsGeometry, material);
    this.add(stairs);
    return stairs;
  }
}

class ResourceManager {
  resources = [];
  track(obj) {
    this.resources.push(obj);
    return obj;
  }
  dispose() {
    for (const obj of this.resources) {
      obj.dispose();
    }
    this.resources = [];
  }
}

class MaterialCache extends ResourceManager {
  dtx;
  lib;
  materials = [];
  onTextureLoad = null;
  constructor(dtx, lib) {
    super();
    this.dtx = dtx;
    this.lib = lib;
  }
  get(type, index) {
    if (!this.materials[type])
      this.materials[type] = [];
    if (!this.materials[type][index]) {
      const textureData = this.dtx.get(type, index);
      const material = new THREE.MeshBasicMaterial;
      this.materials[type][index] = this.track(material);
      if (!textureData) {
        material.color = new THREE.Color(6724095);
      } else {
        decodeImage(this.lib, textureData).then((image) => {
          const texture = this.track(image.texture);
          texture.flipY = true;
          material.map = texture;
          material.transparent = image.hasAlpha;
          material.needsUpdate = true;
          if (this.onTextureLoad)
            this.onTextureLoad();
        });
      }
    }
    return this.materials[type][index];
  }
}

class PolyObjModelFactory extends ResourceManager {
  polyobj2;
  lib;
  models = [];
  materials = [];
  constructor(polyobj2, lib) {
    super();
    this.polyobj = polyobj2;
    this.lib = lib;
  }
  createModel(index) {
    if (this.models[index]) {
      return this.models[index].clone();
    }
    const obj = this.polyobj.objects[index];
    const model = new THREE.Group;
    for (const part of obj.parts) {
      const positions = [];
      const uvs = [];
      for (const triangle of part.triangles) {
        if (!positions[triangle.material]) {
          positions[triangle.material] = [];
          uvs[triangle.material] = [];
        }
        for (const i of [0, 2, 1]) {
          const pos = part.vertices[triangle.index[i]];
          positions[triangle.material].push(pos.x, pos.y, -pos.z);
          const uv = triangle.uv[i];
          uvs[triangle.material].push(uv.u, uv.v);
        }
      }
      for (let i = 0;i < positions.length; i++) {
        if (!positions[i]) {
          continue;
        }
        const geometry = this.track(new THREE.BufferGeometry);
        geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions[i]), 3));
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs[i]), 2));
        model.add(new THREE.Mesh(geometry, this.getMaterial(obj.materials[i])));
      }
    }
    this.models[index] = model;
    return model.clone();
  }
  getMaterial(index) {
    if (!this.materials[index]) {
      const material = new THREE.MeshBasicMaterial;
      this.materials[index] = this.track(material);
      const textureData = this.polyobj.textures[index];
      decodeImage(this.lib, textureData).then((image) => {
        const texture = this.track(image.texture);
        material.map = texture;
        material.transparent = image.hasAlpha;
        material.needsUpdate = true;
      });
    }
    return this.materials[index];
  }
}

// src/lib.ts
async function createModule() {
  const fetched = fetch(new URL("./lib.wasm", import.meta.url));
  const imports = { env: { emscripten_notify_memory_growth: () => {
  } } };
  const { instance } = await WebAssembly.instantiateStreaming(fetched, imports);
  return {
    malloc: instance.exports.malloc,
    free: instance.exports.free,
    qnt_extract: instance.exports.qnt_extract,
    memset: (dst, src) => {
      new Uint8Array(instance.exports.memory.buffer).set(src, dst);
    },
    memget: (ptr, len) => {
      return new Uint8Array(instance.exports.memory.buffer).slice(ptr, ptr + len);
    }
  };
}

// src/index.ts
import {Matrix4} from "https://unpkg.com/three@0.126.1/build/three.module.js";
var setClickHandler = function(element, handler) {
  let dragged = false;
  element.addEventListener("pointerdown", () => dragged = false);
  element.addEventListener("pointermove", () => dragged = true);
  element.addEventListener("click", (ev) => {
    if (!dragged)
      handler(ev);
  });
};
async function handleFiles(files) {
  for (let file of files) {
    await dungeons.addFile(file);
  }
  const ids = dungeons.getIds();
  if (ids.length === 0) {
    return;
  }
  const select = $("#dungeon-id");
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }
  for (const id of ids) {
    const opt = document.createElement("option");
    opt.setAttribute("value", id + "");
    opt.textContent = id + "";
    select.appendChild(opt);
    select.hidden = false;
  }
  if (!viewer) {
    viewer = new DungeonViewer(await createModule());
    window.viewer = viewer;
    $(".usage").hidden = true;
  }
  viewer.view(dungeons, ids[0]);
}
var $ = document.querySelector.bind(document);
var sjisDecoder = new TextDecoder("shift-jis");

class DungeonViewer {
  lib2;
  polyModelFactory = null;
  renderer = new THREE2.WebGLRenderer;
  camera = new THREE2.PerspectiveCamera(50, 1.3333333333333333, 1, 200);
  controls = new OrbitControls2(this.camera, this.renderer.domElement);
  raycaster = new THREE2.Raycaster;
  scene = null;
  model = null;
  selectionMarker = new SelectionMarker;
  visibilityMarker = new VisibilityMarker;
  dirty = false;
  constructor(lib2) {
    this.lib = lib2;
    this.renderer.setSize(800, 600);
    $("#viewer").appendChild(this.renderer.domElement);
    setClickHandler(this.renderer.domElement, this.onCanvasClick.bind(this));
    this.controls.enableDamping = true;
    this.controls.addEventListener("change", () => this.dirty = true);
    this.raycaster.near = this.camera.near;
    $("#show-pvs-check").addEventListener("change", () => {
      if ($("#show-pvs-check").checked)
        this.scene.add(this.visibilityMarker);
      else
        this.scene.remove(this.visibilityMarker);
      this.dirty = true;
    });
    const tick = () => {
      requestAnimationFrame(tick);
      this.controls.update();
      if (this.scene && this.dirty) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
    };
    tick();
  }
  async view(dungeons, index) {
    const dgn = await dungeons.getDugn(index);
    const dtx = await dungeons.getDtex(index);
    if (!this.polyModelFactory) {
      const po = await dungeons.getPolyObj();
      if (po) {
        this.polyModelFactory = new PolyObjModelFactory(po, this.lib);
      }
    }
    if (this.model) {
      this.model.dispose();
    }
    this.model = new DungeonModel(dgn, dtx, this.polyModelFactory, this.lib);
    this.model.onTextureLoad = () => {
      this.dirty = true;
    };
    this.scene = new THREE2.Scene;
    this.scene.add(this.model);
    if ($("#show-pvs-check").checked)
      this.scene.add(this.visibilityMarker);
    this.camera.position.set(dgn.sizeX, dgn.sizeY * 4, 40);
    this.controls.target.set(dgn.sizeX - 1, dgn.sizeY - 1, -dgn.sizeZ - 1);
    this.dirty = true;
    $("#cellinfo").hidden = true;
    $("#cellinfo-rance6").hidden = true;
    $("#cellinfo-galzoo").hidden = true;
    $("#show-pvs").hidden = true;
    this.visibilityMarker.clearPVS();
  }
  onCanvasClick(evt) {
    if (!this.model) {
      return;
    }
    this.dirty = true;
    const canvas = this.renderer.domElement;
    const x = (window.scrollX + evt.clientX - canvas.offsetLeft) / canvas.offsetWidth * 2 - 1;
    const y = (window.scrollY + evt.clientY - canvas.offsetTop) / canvas.offsetHeight * -2 + 1;
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const intersects = this.raycaster.intersectObjects(this.model.children, true);
    let obj = intersects[0] ? intersects[0].object : null;
    while (obj && !(obj instanceof CellModel)) {
      obj = obj.parent;
    }
    if (!obj) {
      this.scene.remove(this.selectionMarker);
      this.visibilityMarker.clearPVS();
      return;
    }
    this.selectCell(obj.x, obj.y, obj.z);
  }
  selectCell(x, y, z) {
    if (!this.model) {
      return;
    }
    const cell = this.model.dgn.cellAt(x, y, z);
    this.scene.add(this.selectionMarker);
    this.selectionMarker.position.set(x * 2, y * 2, z * -2);
    this.dirty = true;
    const pvs = this.model.dgn.pvsAt(x, y, z);
    if (pvs) {
      this.visibilityMarker.setPVS(pvs);
      $("#show-pvs").hidden = false;
    }
    $("#scenario-coords").innerText = `(${x + 1}, ${this.model.sizeZ - z}, ${y + 1})`;
    $("#dungeon-coords").innerText = `(${x}, ${y}, ${z})`;
    for (let i = 0;i < 35; i++) {
      $("#cell-attr" + i).innerText = cell.getAttr(i) + "";
    }
    $("#cellinfo").hidden = false;
    if (cell.version != 8) {
      $("#cell-unknown1").innerText = cell.unknown1 + "";
      $("#cell-buttlebg").innerText = cell.buttle_background + "";
    }
    if (cell.version != 13) {
      for (let i = 0;i < 6; i++) {
        $("#cell-rance6-num" + (i + 1)).innerText = cell.pairs[i].n + "";
        $("#cell-rance6-str" + (i + 1)).innerText = '"' + sjisDecoder.decode(cell.pairs[i].s) + '"';
      }
      $("#cellinfo-rance6").hidden = false;
    } else if (cell.version == 13) {
      $("#cell-galzoo178").innerText = cell.polyobj_index + "";
      if (cell.polyobj_index >= 0) {
        const name = this.polyModelFactory.polyobj.objects[cell.polyobj_index].name;
        $("#cell-galzoo178").innerText += " (" + sjisDecoder.decode(name) + ")";
      }
      $("#cell-galzoo182").innerText = cell.polyobj_scale.toFixed(3);
      $("#cell-galzoo186").innerText = cell.polyobj_rotationY.toFixed(3);
      $("#cell-galzoo190").innerText = cell.polyobj_rotationZ.toFixed(3);
      $("#cell-galzoo194").innerText = cell.polyobj_rotationX.toFixed(3);
      $("#cell-galzoo198").innerText = cell.polyobj_positionX.toFixed(3);
      $("#cell-galzoo202").innerText = cell.polyobj_positionY.toFixed(3);
      $("#cell-galzoo206").innerText = cell.polyobj_positionZ.toFixed(3);
      $("#cell-galzoo210").innerText = cell.roof_orientation + "";
      $("#cell-galzoo214").innerText = cell.roof_texture + "";
      $("#cell-galzoo222").innerText = cell.roof_underside_texture + "";
      $("#cellinfo-galzoo").hidden = false;
    }
  }
}

class SelectionMarker extends THREE2.Mesh {
  constructor() {
    const geometry = new THREE2.BoxGeometry(2, 2, 2);
    const material = new THREE2.MeshBasicMaterial({ color: 16776960, transparent: true, opacity: 0.5 });
    super(geometry, material);
  }
}

class VisibilityMarker extends THREE2.InstancedMesh {
  constructor() {
    const geometry = new THREE2.BoxGeometry(2, 2, 2);
    const material = new THREE2.MeshBasicMaterial({ color: 16777215, transparent: true, opacity: 0.2 });
    super(geometry, material, 5000);
  }
  setPVS(pvs) {
    const cells = pvs.getVisibleCells();
    this.count = cells.length;
    for (let i = 0;i < cells.length; i++) {
      const c = cells[i];
      this.setMatrixAt(i, new Matrix4().makeTranslation(c.x * 2, c.y * 2, c.z * -2));
    }
    this.instanceMatrix.needsUpdate = true;
  }
  clearPVS() {
    this.count = 0;
  }
}
var dungeons = new DungeonCollection;
var viewer;
document.body.addEventListener("dragover", (evt) => {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = "copy";
}, false);
document.body.addEventListener("drop", (evt) => {
  evt.stopPropagation();
  evt.preventDefault();
  handleFiles(evt.dataTransfer.files);
}, false);
$("#fileselect").addEventListener("change", (evt) => {
  let input = evt.target;
  handleFiles(input.files);
}, false);
$("#dungeon-id").addEventListener("change", async (evt) => {
  let input = evt.target;
  const index = Number(input.value);
  viewer.view(dungeons, index);
}, false);
export {
  $
};
